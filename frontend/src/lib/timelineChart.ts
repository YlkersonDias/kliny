import type { TimelineGrouping, TimelinePoint } from '../api/types'
import { formatDate, formatMonthYear } from './dates'

// Linha do tempo dos Relatórios: expense já vem positivo (convenção dos relatórios).

const toCents = (value: number) => Math.round(value * 100)

// Rótulo completo do período ("05/10/2026" ou "Outubro de 2026"), para tabela e resumo.
export function periodLabel(period: string, grouping: TimelineGrouping): string {
  return grouping === 'day' ? formatDate(period) : formatMonthYear(period)
}

const SHORT_MONTHS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']

// Rótulo curto do eixo ("05/10" ou "out/26").
export function axisLabel(period: string, grouping: TimelineGrouping): string {
  if (grouping === 'day') return `${period.slice(8, 10)}/${period.slice(5, 7)}`
  return `${SHORT_MONTHS[Number(period.slice(5, 7)) - 1]}/${period.slice(2, 4)}`
}

export interface TimelineSummary {
  income: number
  expense: number
  // Período de maior gasto; null sem gasto. Empate: o primeiro.
  maxExpense: { label: string; expense: number } | null
  // Períodos com algum movimento.
  activePeriods: number
}

export function summarizeTimeline(points: TimelinePoint[], grouping: TimelineGrouping): TimelineSummary {
  let incomeCents = 0
  let expenseCents = 0
  let activePeriods = 0
  let max: TimelinePoint | null = null
  for (const point of points) {
    incomeCents += toCents(point.income)
    expenseCents += toCents(point.expense)
    if (point.income > 0 || point.expense > 0) activePeriods++
    if (point.expense > 0 && (!max || point.expense > max.expense)) max = point
  }
  return {
    income: incomeCents / 100,
    expense: expenseCents / 100,
    maxExpense: max ? { label: periodLabel(max.period, grouping), expense: max.expense } : null,
    activePeriods,
  }
}
