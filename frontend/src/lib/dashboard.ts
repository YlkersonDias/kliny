import type { SummaryResponse, TimelinePoint } from '../api/types'

// Cálculos do Dashboard sobre os relatórios. expense já vem positivo (convenção dos relatórios).

const toCents = (value: number) => Math.round(value * 100)

export interface DaySpending {
  date: string // YYYY-MM-DD
  day: number
  expense: number
  // Data depois de hoje: já lançado, mas ainda não aconteceu.
  isFuture: boolean
}

// Um item por dia da timeline (groupBy=day), na ordem do mês.
export function dailySpending(points: TimelinePoint[], today: string): DaySpending[] {
  return points.map((point) => ({
    date: point.period,
    day: Number(point.period.slice(8, 10)),
    expense: point.expense,
    isFuture: point.period > today,
  }))
}

export interface SpendingSummary {
  // Até hoje (inclusive).
  total: number
  daysWithSpending: number
  // Dia de maior gasto até hoje; null sem gasto. Empate: o primeiro dia.
  max: DaySpending | null
  // Gastos com data depois de hoje, já lançados.
  futureTotal: number
}

export function summarizeSpending(days: DaySpending[]): SpendingSummary {
  let totalCents = 0
  let futureCents = 0
  let daysWithSpending = 0
  let max: DaySpending | null = null
  for (const day of days) {
    if (day.expense <= 0) continue
    if (day.isFuture) {
      futureCents += toCents(day.expense)
      continue
    }
    totalCents += toCents(day.expense)
    daysWithSpending++
    if (!max || day.expense > max.expense) max = day
  }
  return { total: totalCents / 100, daysWithSpending, max, futureTotal: futureCents / 100 }
}

// Há lançamento no mês com data depois de hoje? Receita ou gasto (timeline) ou operação de
// cofre (o saldo da conta no fim do mês difere do de hoje). Nesse caso "Entrou − Saiu"
// não fecha com "Na conta", e a tela explica.
export function hasFutureEntries(points: TimelinePoint[], today: string, month: SummaryResponse, now: SummaryResponse): boolean {
  if (toCents(month.accountBalance) !== toCents(now.accountBalance)) return true
  return points.some((point) => point.period > today && (point.income > 0 || point.expense > 0))
}
