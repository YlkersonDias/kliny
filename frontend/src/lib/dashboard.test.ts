import { describe, expect, it } from 'vitest'
import type { SummaryResponse, TimelinePoint } from '../api/types'
import { dailySpending, hasFutureEntries, summarizeSpending } from './dashboard'

const point = (period: string, expense: number, income = 0): TimelinePoint => ({ period, income, expense, net: income - expense })

const POINTS = [
  point('2026-10-01', 1200),
  point('2026-10-02', 0.1),
  point('2026-10-03', 0.2),
  point('2026-10-04', 0),
  point('2026-10-05', 1200), // empate com o dia 1
  point('2026-10-06', 300), // depois de hoje
  point('2026-10-07', 0, 50), // receita futura
]

describe('dailySpending', () => {
  it('marca o dia e os dias futuros', () => {
    const days = dailySpending(POINTS, '2026-10-05')
    expect(days[0]).toEqual({ date: '2026-10-01', day: 1, expense: 1200, isFuture: false })
    expect(days[4].isFuture).toBe(false)
    expect(days[5].isFuture).toBe(true)
  })
})

describe('summarizeSpending', () => {
  it('soma até hoje em centavos e separa o futuro', () => {
    const summary = summarizeSpending(dailySpending(POINTS, '2026-10-05'))
    expect(summary.total).toBe(2400.3)
    expect(summary.daysWithSpending).toBe(4)
    expect(summary.max?.day).toBe(1)
    expect(summary.futureTotal).toBe(300)
  })

  it('mês sem gasto', () => {
    expect(summarizeSpending(dailySpending([point('2026-10-01', 0)], '2026-10-05')))
      .toEqual({ total: 0, daysWithSpending: 0, max: null, futureTotal: 0 })
  })
})

describe('hasFutureEntries', () => {
  const summary = (accountBalance: number): SummaryResponse => ({
    from: '', to: '', income: 0, expense: 0, net: 0, vaultDeposits: 0, vaultWithdrawals: 0, accountBalance, vaultsBalance: 0,
  })

  it('sem nada depois de hoje', () => {
    expect(hasFutureEntries(POINTS.slice(0, 5), '2026-10-05', summary(10), summary(10))).toBe(false)
  })

  it('gasto ou receita depois de hoje', () => {
    expect(hasFutureEntries(POINTS.slice(0, 6), '2026-10-05', summary(10), summary(10))).toBe(true)
    expect(hasFutureEntries([point('2026-10-07', 0, 50)], '2026-10-05', summary(10), summary(10))).toBe(true)
  })

  it('operação de cofre futura muda só o saldo', () => {
    expect(hasFutureEntries([], '2026-10-05', summary(-90), summary(10))).toBe(true)
  })
})
