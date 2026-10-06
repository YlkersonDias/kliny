import type { TimelineGrouping, TimelinePoint } from '../api/types'
import { currentLanguage } from '../i18n'
import { formatDate, formatMonthYear } from './dates'
import type { Language } from './language'

// Linha do tempo dos Relatórios: expense já vem positivo (convenção dos relatórios).

const toCents = (value: number) => Math.round(value * 100)

// Rótulo completo do período ("05/10/2026" ou "Outubro de 2026"), para tabela e resumo.
export function periodLabel(period: string, grouping: TimelineGrouping): string {
  return grouping === 'day' ? formatDate(period) : formatMonthYear(period)
}

// Sem o ponto que o Intl põe em português ("out."): o eixo tem pouco espaço.
const SHORT_MONTHS: Record<Language, string[]> = {
  'pt-BR': ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'],
  'en-US': ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
}

// Rótulo curto do eixo ("05/10" ou "out/26"; em inglês, "10/05" ou "Oct/26").
export function axisLabel(period: string, grouping: TimelineGrouping, language: Language = currentLanguage()): string {
  const day = period.slice(8, 10)
  const month = period.slice(5, 7)
  if (grouping === 'day') return language === 'en-US' ? `${month}/${day}` : `${day}/${month}`
  return `${SHORT_MONTHS[language][Number(month) - 1]}/${period.slice(2, 4)}`
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
