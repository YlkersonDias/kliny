import type { CategoryRule, ImportLineStatus } from '../api/types'
import { matchRule, normalizeForMatch } from './categoryRules'
import type { StatementLine } from './ofx'

// Revisão da importação (8.3): o que cada linha do extrato vira antes de ir para a API.

// Pagamento de fatura e dinheiro guardado (caixinha, aplicação) aparecem no extrato como saída,
// mas não são gasto: contariam em dobro com as compras do cartão ou com um cofre. Do lado do
// cartão, o "pagamento recebido" também não é receita. Essas linhas vêm desmarcadas.
const TRANSFER_PATTERNS = [
  /\bfatura\b/, /\bpag(to)? fat\b/, /\bpagamento recebido\b/, /\bcaixinhas?\b/, /\bcofrinhos?\b/, /\bporquinhos?\b/,
  /\baplicacao\b/, /\bresgate\b/, /\brdb\b/, /\bcdb\b/, /\bpoupanca\b/, /\binvestimentos?\b/,
]

export function looksLikeTransfer(description: string): boolean {
  const text = normalizeForMatch(description)
  return TRANSFER_PATTERNS.some((pattern) => pattern.test(text))
}

export type ReviewFlag = 'imported' | 'similar' | 'transfer' | null

export interface ReviewRow {
  line: StatementLine
  flag: ReviewFlag
  // Já importada: não pode ser marcada.
  disabled: boolean
  selected: boolean
  // '' = sem categoria.
  categoryId: string
  // A regra que sugeriu a categoria, para mostrar de onde ela veio.
  rulePattern: string | null
}

// Nova e sem nada a conferir: marcada. Parecida com um lançamento existente ou com cara de
// transferência: desmarcada, para a pessoa decidir. Já importada: desmarcada e travada.
export function buildReviewRows(lines: readonly StatementLine[], statuses: readonly ImportLineStatus[], rules: readonly CategoryRule[]): ReviewRow[] {
  return lines.map((line, i) => {
    const status = statuses[i] ?? 'new'
    const flag: ReviewFlag = status === 'imported' ? 'imported'
      : status === 'similar' ? 'similar'
        : looksLikeTransfer(line.description) ? 'transfer'
          : null
    const rule = matchRule(line.description, rules)
    return {
      line,
      flag,
      disabled: flag === 'imported',
      selected: flag === null,
      categoryId: rule ? String(rule.categoryId) : '',
      rulePattern: rule?.pattern ?? null,
    }
  })
}

export function dateSpan(lines: readonly StatementLine[]): { from: string; to: string } | null {
  if (lines.length === 0) return null
  let from = lines[0].date
  let to = lines[0].date
  for (const { date } of lines) {
    if (date < from) from = date
    if (date > to) to = date
  }
  return { from, to }
}
