import type { CategoryRule } from '../api/types'

export const RULE_PATTERN_MAX = 100

// Como a collation do banco: sem diferenciar maiúsculas nem acentos.
export function normalizeForMatch(text: string): string {
  return text.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLocaleLowerCase('pt-BR')
}

// O texto mais longo vence ("mercado livre" vence "mercado"); no empate, a ordem alfabética, para o
// resultado não depender da ordem da lista.
export function matchRule(description: string, rules: readonly CategoryRule[]): CategoryRule | null {
  const text = normalizeForMatch(description)
  if (!text.trim()) return null
  let best: CategoryRule | null = null
  for (const rule of rules) {
    const pattern = normalizeForMatch(rule.pattern)
    if (!pattern || !text.includes(pattern)) continue
    if (!best || pattern.length > normalizeForMatch(best.pattern).length
      || (pattern.length === normalizeForMatch(best.pattern).length && pattern < normalizeForMatch(best.pattern))) {
      best = rule
    }
  }
  return best
}
