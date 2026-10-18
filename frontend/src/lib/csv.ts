import { normalizeForMatch } from './categoryRules'
import { isValidIsoDate } from './dates'
import { DESCRIPTION_MAX, parseOfxAmount, withOccurrences, type StatementLine } from './ofx'

// Leitor de extrato CSV, só no navegador. A pessoa diz qual coluna é o quê; as de layouts
// conhecidos vêm sugeridas pelo cabeçalho.

export type DateFormat = 'dmy' | 'mdy' | 'ymd'

export interface CsvMapping {
  headerRow: number
  hasHeader: boolean
  date: number
  dateFormat: DateFormat
  description: number
  description2: number | null
  // Uma coluna com sinal, ou duas (crédito e débito).
  amount: number | null
  credit: number | null
  debit: number | null
  id: number | null
  // Extrato de cartão costuma trazer a compra positiva.
  invert: boolean
}

export interface CsvTable {
  rows: string[][]
  delimiter: string
}

const DELIMITERS = [';', ',', '\t'] as const

// RFC 4180: aspas em volta do campo, "" dentro delas e quebra de linha dentro das aspas.
export function parseCsv(text: string): CsvTable {
  const clean = text.replace(/^\uFEFF/, '')
  const delimiter = detectDelimiter(clean)
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let quoted = false
  for (let i = 0; i < clean.length; i++) {
    const char = clean[i]
    if (quoted) {
      if (char === '"') {
        if (clean[i + 1] === '"') {
          cell += '"'
          i++
        } else {
          quoted = false
        }
      } else {
        cell += char
      }
    } else if (char === '"' && cell.trim() === '') {
      cell = ''
      quoted = true
    } else if (char === delimiter) {
      row.push(cell.trim())
      cell = ''
    } else if (char === '\n' || char === '\r') {
      if (char === '\r' && clean[i + 1] === '\n') i++
      row.push(cell.trim())
      if (row.some((value) => value !== '')) rows.push(row)
      row = []
      cell = ''
    } else {
      cell += char
    }
  }
  row.push(cell.trim())
  if (row.some((value) => value !== '')) rows.push(row)
  return { rows, delimiter }
}

function detectDelimiter(text: string): string {
  const lines = text.split(/\r?\n/).filter((line) => line.trim() !== '').slice(0, 30)
  let best: string = ';'
  let bestScore = -1
  for (const delimiter of DELIMITERS) {
    const counts = lines.map((line) => countOutsideQuotes(line, delimiter)).filter((count) => count > 0)
    if (counts.length === 0) continue
    const frequency = new Map<number, number>()
    for (const count of counts) frequency.set(count, (frequency.get(count) ?? 0) + 1)
    const score = Math.max(...frequency.values())
    if (score > bestScore) {
      best = delimiter
      bestScore = score
    }
  }
  return best
}

function countOutsideQuotes(line: string, delimiter: string): number {
  let count = 0
  let quoted = false
  for (const char of line) {
    if (char === '"') quoted = !quoted
    else if (char === delimiter && !quoted) count++
  }
  return count
}

// Alguns bancos põem linhas soltas antes da tabela: o cabeçalho é a primeira linha com o número
// de colunas mais comum.
export function findHeaderRow(rows: readonly string[][]): number {
  const frequency = new Map<number, number>()
  for (const row of rows) frequency.set(row.length, (frequency.get(row.length) ?? 0) + 1)
  let width = 0
  let most = 0
  for (const [length, count] of frequency) {
    if (length >= 2 && (count > most || (count === most && length > width))) {
      width = length
      most = count
    }
  }
  const index = rows.findIndex((row) => row.length === width)
  return Math.max(0, index)
}

export function looksLikeHeader(row: readonly string[]): boolean {
  return row.every((cell) => cell === '' || (detectDateFormat([cell]) === null && parseCsvAmount(cell) === null))
}

const HEADER_PATTERNS = {
  date: /^(data|date|dt)\b/,
  description: /descri|title|titulo|estabelecimento|lancamento|memo/,
  history: /histor/,
  amount: /^(valor|amount|value|quantia)\b|valor \(r\$\)|valor r\$/,
  credit: /credito|entrada/,
  debit: /debito|saida/,
  id: /^(identificador|id|codigo|fitid)\b/,
}

export function guessMapping(rows: readonly string[][]): CsvMapping {
  const headerRow = findHeaderRow(rows)
  const header = rows[headerRow] ?? []
  const hasHeader = looksLikeHeader(header)
  const sample = rows.slice(headerRow + (hasHeader ? 1 : 0)).filter((row) => row.length === header.length).slice(0, 20)
  const names = header.map((cell) => (hasHeader ? normalizeForMatch(cell).trim() : ''))
  const find = (pattern: RegExp, except: number[] = []) => {
    const index = names.findIndex((name, i) => !except.includes(i) && pattern.test(name) && !/saldo|balance/.test(name))
    return index >= 0 ? index : null
  }
  const column = (i: number) => sample.map((row) => row[i] ?? '')

  let date = find(HEADER_PATTERNS.date)
  if (date === null) {
    const index = header.findIndex((_, i) => detectDateFormat(column(i)) !== null)
    date = index >= 0 ? index : 0
  }

  // Inter: "Histórico" (Pix enviado) e "Descrição" (Maria) dizem mais juntos.
  const history = find(HEADER_PATTERNS.history, [date])
  let description = find(HEADER_PATTERNS.description, [date])
  let description2: number | null = null
  if (history !== null && description !== null) {
    description2 = description
    description = history
  } else if (description === null) {
    description = history
  }

  let amount = find(HEADER_PATTERNS.amount, [date])
  const credit = amount === null ? find(HEADER_PATTERNS.credit, [date]) : null
  const debit = amount === null ? find(HEADER_PATTERNS.debit, [date]) : null
  const taken = [date, description, description2, credit, debit].filter((i): i is number => i !== null)
  if (amount === null && credit === null && debit === null) {
    const index = header.findIndex((_, i) => !taken.includes(i) && column(i).length > 0 && column(i).every((value) => parseCsvAmount(value) !== null))
    amount = index >= 0 ? index : null
  }
  if (description === null) {
    let longest = -1
    header.forEach((_, i) => {
      if ([...taken, amount].includes(i)) return
      const size = column(i).reduce((total, value) => total + value.length, 0)
      if (longest < 0 || size > column(longest).reduce((total, value) => total + value.length, 0)) longest = i
    })
    description = Math.max(0, longest)
  }

  return {
    headerRow,
    hasHeader,
    date,
    dateFormat: detectDateFormat(column(date)) ?? 'dmy',
    description,
    description2,
    amount,
    credit,
    debit,
    id: find(HEADER_PATTERNS.id, [date, description]),
    invert: false,
  }
}

// Com o ano no fim, dmy, a menos que o segundo número passe de 12 em alguma linha (mdy).
export function detectDateFormat(values: readonly string[]): DateFormat | null {
  const filled = values.map((value) => value.trim()).filter(Boolean)
  if (filled.length === 0) return null
  if (filled.every((value) => /^\d{4}[-/.]\d{1,2}[-/.]\d{1,2}/.test(value))) return 'ymd'
  const parts = filled.map((value) => /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2}|\d{4})\b/.exec(value))
  if (parts.some((match) => match === null)) return null
  if (parts.some((match) => Number(match![2]) > 12)) return 'mdy'
  return 'dmy'
}

export function parseCsvDate(raw: string, format: DateFormat): string | null {
  const value = raw.trim()
  let year: string, month: string, day: string
  if (format === 'ymd') {
    const match = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})\b/.exec(value)
    if (!match) return null;
    [, year, month, day] = match
  } else {
    const match = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2}|\d{4})\b/.exec(value)
    if (!match) return null
    const [, first, second, y] = match
    ;[day, month] = format === 'dmy' ? [first, second] : [second, first]
    year = y.length === 2 ? `20${y}` : y
  }
  const iso = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`
  return isValidIsoDate(iso) ? iso : null
}

// Além do que o OFX aceita: "R$", parênteses ("(12,34)") e o sinal no fim ("12,34-").
export function parseCsvAmount(raw: string): number | null {
  let text = raw.replace(/R\$/gi, '').replace(/\s/g, '')
  let negative = false
  const parenthesis = /^\((.*)\)$/.exec(text)
  if (parenthesis) {
    text = parenthesis[1]
    negative = true
  } else if (/^\d.*-$/.test(text)) {
    text = text.slice(0, -1)
    negative = true
  }
  const value = parseOfxAmount(text)
  if (value === null) return null
  return negative ? -Math.abs(value) : value
}

export interface CsvResult {
  lines: StatementLine[]
  skipped: number
}

export function applyMapping(rows: readonly string[][], mapping: CsvMapping): CsvResult {
  const source = csvSource(rows, mapping)
  const data = rows.slice(mapping.headerRow + (mapping.hasHeader ? 1 : 0))
  const lines: Omit<StatementLine, 'occurrence'>[] = []
  let skipped = 0
  for (const row of data) {
    const line = mapRow(row, mapping, source)
    if (line) lines.push(line)
    else skipped++
  }
  return { lines: withOccurrences(lines), skipped }
}

export function mapRow(row: readonly string[], mapping: CsvMapping, source = 'csv'): Omit<StatementLine, 'occurrence'> | null {
  const date = parseCsvDate(row[mapping.date] ?? '', mapping.dateFormat)
  let amount: number | null
  if (mapping.amount !== null) {
    amount = parseCsvAmount(row[mapping.amount] ?? '')
  } else {
    const credit = cellAmount(row, mapping.credit)
    const debit = cellAmount(row, mapping.debit)
    amount = credit === null || debit === null ? null : Math.round((Math.abs(credit) - Math.abs(debit)) * 100) / 100
  }
  if (!date || amount === null || amount === 0) return null
  if (mapping.invert) amount = -amount

  const main = clean(row[mapping.description] ?? '')
  const extra = mapping.description2 === null ? '' : clean(row[mapping.description2] ?? '')
  const description = (main && extra && !main.toLowerCase().includes(extra.toLowerCase()) ? `${main} - ${extra}` : main || extra || '—')
    .slice(0, DESCRIPTION_MAX).trim()
  const id = mapping.id === null ? '' : (row[mapping.id] ?? '').trim()
  return { source, externalId: id ? id.slice(0, 255) : null, date, amount, description }
}

function cellAmount(row: readonly string[], index: number | null): number | null {
  if (index === null) return 0
  const value = (row[index] ?? '').trim()
  return value === '' ? 0 : parseCsvAmount(value)
}

function clean(text: string): string {
  return text.replace(/\s+/g, ' ').trim()
}

// O CSV não diz a conta: o cabeçalho separa os layouts, para linhas iguais de bancos diferentes
// não se confundirem.
export function csvSource(rows: readonly string[][], mapping: CsvMapping): string {
  if (!mapping.hasHeader) return 'csv'
  return `csv:${layoutKey(rows[mapping.headerRow] ?? [])}`
}

export function layoutKey(header: readonly string[]): string {
  let hash = 0x811c9dc5
  for (const char of header.map((cell) => normalizeForMatch(cell).trim()).join('|')) {
    hash ^= char.codePointAt(0)!
    hash = Math.imul(hash, 0x01000193) >>> 0
  }
  return hash.toString(16).padStart(8, '0')
}

export function mappingError(mapping: CsvMapping): 'amount' | null {
  return mapping.amount === null && mapping.credit === null && mapping.debit === null ? 'amount' : null
}
