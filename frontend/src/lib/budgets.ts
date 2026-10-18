import type { DateRange } from './dates'

export const NEAR_LIMIT = 0.8

export type BudgetStatus = 'ok' | 'near' | 'over'

export interface BudgetProgress {
  status: BudgetStatus
  // Arredondado para baixo: 99,6% aparece como 99%, nunca 100% antes do limite.
  percent: number
  bar: number
  // Sempre positivo: quanto falta ou quanto passou.
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

export function budgetMonth(range: DateRange): string {
  return range.from.slice(0, 7)
}
