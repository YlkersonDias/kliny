import type { CategoryRule } from '../api/types'

// Mesma regra do CategoryRuleRequest da API.
export const RULE_PATTERN_MAX = 100

// Para comparar como o banco (collation utf8mb4_0900_ai_ci): sem diferenciar maiúsculas nem acentos.
export function normalizeForMatch(text: string): string {
  return text.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLocaleLowerCase('pt-BR')
}

// A regra que vale para a descrição: a de texto mais longo entre as que batem ("mercado livre"
// vence "mercado"); no empate, a primeira em ordem alfabética, para o resultado não depender da ordem da lista.
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
