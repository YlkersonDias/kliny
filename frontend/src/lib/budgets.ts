import type { DateRange } from './dates'

// Orçamento por categoria (8.2): a situação de uma categoria no mês.
// A partir de NEAR_LIMIT (80%) avisa que está perto; acima do limite, quanto passou.
export const NEAR_LIMIT = 0.8

export type BudgetStatus = 'ok' | 'near' | 'over'

export interface BudgetProgress {
  status: BudgetStatus
  // Percentual gasto, arredondado para baixo (99,6% aparece como 99%, nunca 100% antes do limite).
  percent: number
  // Largura da barra, de 0 a 100.
  bar: number
  // Quanto falta (status ok ou near) ou quanto passou (over), sempre positivo.
  difference: number
}

function cents(value: number): number {
  return Math.round(value * 100)
}

export function budgetProgress(limit: number, spent: number): BudgetProgress {
  const limitCents = cents(limit)
  const spentCents = cents(spent)
  const percent = limitCents > 0 ? Math.floor((spentCents * 100) / limitCents) : 0
  const status: BudgetStatus = spentCents > limitCents ? 'over' : spentCents >= limitCents * NEAR_LIMIT ? 'near' : 'ok'
  return {
    status,
    percent,
    bar: Math.min(percent, 100),
    difference: Math.abs(limitCents - spentCents) / 100,
  }
}

// Mês do orçamento na API ("2026-10"), a partir do período do mês calculado no navegador.
export function budgetMonth(range: DateRange): string {
  return range.from.slice(0, 7)
}
