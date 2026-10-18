import { isValidIsoDate } from './dates'
import { MONEY_MAX } from './money'

// Leitor de extrato OFX 1.x (SGML) e 2.x (XML), só no navegador: o arquivo nunca vai para a API.

// Mesmo limite da API e do corpo aceito pelo nginx.
export const IMPORT_MAX_LINES = 1000
export const OFX_MAX_BYTES = 1024 * 1024
export const DESCRIPTION_MAX = 255

export interface StatementLine {
  // Banco e só os 4 últimos dígitos da conta: separa contas sem guardar o número.
  source: string
  externalId: string | null
  date: string
  amount: number
  description: string
  occurrence: number
}

export interface OfxResult {
  lines: StatementLine[]
  skipped: number
}

export class OfxError extends Error {
  readonly code: 'notOfx' | 'empty'

  constructor(code: 'notOfx' | 'empty') {
    super(code)
    this.name = 'OfxError'
    this.code = code
  }
}

// Muitos bancos gravam em Windows-1252, que quase nunca é UTF-8 válido: tenta UTF-8 primeiro.
export function decodeStatement(bytes: Uint8Array): string {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes)
  } catch {
    return new TextDecoder('windows-1252').decode(bytes)
  }
}

export function parseOfx(text: string): OfxResult {
  if (!/<OFX>/i.test(text)) throw new OfxError('notOfx')

  const statements = [...text.matchAll(/<(CC)?STMTRS>([\s\S]*?)<\/(CC)?STMTRS>/gi)].map((m) => m[2])
  if (statements.length === 0) statements.push(text)

  const lines: Omit<StatementLine, 'occurrence'>[] = []
  let skipped = 0
  let found = 0
  for (const statement of statements) {
    const source = sourceOf(statement)
    for (const match of statement.matchAll(/<STMTTRN>([\s\S]*?)<\/STMTTRN>/gi)) {
      found++
      const block = match[1]
      const date = parseOfxDate(field(block, 'DTPOSTED') ?? '')
      const amount = parseOfxAmount(field(block, 'TRNAMT') ?? '')
      if (!date || amount === null || amount === 0) {
        skipped++
        continue
      }
      lines.push({
        source,
        externalId: field(block, 'FITID') || null,
        date,
        amount,
        description: describe(block),
      })
    }
  }
  if (found === 0) throw new OfxError('empty')

  return { lines: withOccurrences(lines), skipped }
}

// Duas compras iguais no mesmo dia viram as linhas 1 e 2 (a mesma regra da chave na API).
export function withOccurrences(lines: readonly Omit<StatementLine, 'occurrence'>[]): StatementLine[] {
  const seen = new Map<string, number>()
  return lines.map((line) => {
    const key = [line.source, line.externalId ?? '', line.date, line.amount.toFixed(2), line.externalId ? '' : line.description].join('\n')
    const occurrence = (seen.get(key) ?? 0) + 1
    seen.set(key, occurrence)
    return { ...line, occurrence }
  })
}

export function parseOfxDate(raw: string): string | null {
  const digits = raw.trim().replace(/^(\d{4})-(\d{2})-(\d{2})/, '$1$2$3')
  const match = /^(\d{4})(\d{2})(\d{2})/.exec(digits)
  if (!match) return null
  const iso = `${match[1]}-${match[2]}-${match[3]}`
  return isValidIsoDate(iso) ? iso : null
}

// O padrão é "-1234.56", mas há bancos que mandam "-1234,56" ou "1.234,56".
export function parseOfxAmount(raw: string): number | null {
  let text = raw.replace(/\s/g, '')
  if (text.includes(',')) {
    text = text.includes('.') && text.lastIndexOf('.') > text.lastIndexOf(',')
      ? text.replace(/,/g, '')
      : text.replace(/\./g, '').replace(',', '.')
  }
  const match = /^([+-]?)(\d+)(?:\.(\d+))?$/.exec(text)
  if (!match) return null
  const decimals = (match[3] ?? '').replace(/0+$/, '')
  if (decimals.length > 2) return null
  const cents = Number(match[2]) * 100 + Number(decimals.padEnd(2, '0'))
  if (!Number.isSafeInteger(cents) || cents / 100 > MONEY_MAX) return null
  const value = cents / 100
  return match[1] === '-' ? -value : value
}

function sourceOf(statement: string): string {
  const account = /<(BANK|CC)ACCTFROM>([\s\S]*?)(<\/(BANK|CC)ACCTFROM>|$)/i.exec(statement)
  const block = account?.[2] ?? ''
  const bank = (field(block, 'BANKID') ?? '').replace(/\W/g, '') || (account?.[1]?.toUpperCase() === 'CC' ? 'cc' : 'ofx')
  const digits = (field(block, 'ACCTID') ?? '').replace(/\W/g, '')
  return `${bank.slice(0, 20)}:${digits.slice(-4)}`
}

function describe(block: string): string {
  const name = clean(field(block, 'NAME') ?? '')
  const memo = clean(field(block, 'MEMO') ?? '')
  let text: string
  if (name && memo) {
    const a = name.toLowerCase()
    const b = memo.toLowerCase()
    text = b.includes(a) ? memo : a.includes(b) ? name : `${name} - ${memo}`
  } else {
    text = name || memo || clean(field(block, 'TRNTYPE') ?? '') || 'OFX'
  }
  return text.slice(0, DESCRIPTION_MAX).trim()
}

// No SGML a tag de valor não fecha: o valor vai até o próximo "<" ou o fim da linha.
function field(block: string, name: string): string | null {
  const match = new RegExp(`<${name}>([^<\\r\\n]*)`, 'i').exec(block)
  return match ? decodeEntities(match[1]).trim() : null
}

function clean(text: string): string {
  return text.replace(/\s+/g, ' ').trim()
}

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' }

function decodeEntities(text: string): string {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (whole, entity: string) => {
    if (entity[0] === '#') {
      const code = entity[1].toLowerCase() === 'x' ? parseInt(entity.slice(2), 16) : parseInt(entity.slice(1), 10)
      return code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : whole
    }
    return ENTITIES[entity.toLowerCase()] ?? whole
  })
}
