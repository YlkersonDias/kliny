import { describe, expect, it } from 'vitest'
import type { TimelinePoint } from '../api/types'
import { axisLabel, periodLabel, summarizeTimeline } from './timelineChart'

const point = (period: string, income: number, expense: number): TimelinePoint => ({ period, income, expense, net: income - expense })

describe('rótulos', () => {
  it('por dia e por mês', () => {
    expect(periodLabel('2026-10-05', 'day')).toBe('05/10/2026')
    expect(periodLabel('2026-10-01', 'month')).toBe('Outubro de 2026')
    expect(axisLabel('2026-10-05', 'day')).toBe('05/10')
    expect(axisLabel('2027-01-01', 'month')).toBe('jan/27')
  })
})

describe('summarizeTimeline', () => {
  it('totais em centavos, maior gasto e períodos com movimento', () => {
    const summary = summarizeTimeline([
      point('2026-08-01', 3500, 600.1), point('2026-09-01', 0, 0), point('2026-10-01', 3700, 890.2), point('2026-11-01', 0, 890.2),
    ], 'month')
    expect(summary).toEqual({
      income: 7200, expense: 2380.5, maxExpense: { label: 'Outubro de 2026', expense: 890.2 }, activePeriods: 3,
    })
  })

  it('sem gasto', () => {
    expect(summarizeTimeline([point('2026-10-01', 10, 0)], 'day').maxExpense).toBeNull()
  })
})

describe('rótulos em inglês', () => {
  it('mês antes do dia e meses em inglês', () => {
    expect(axisLabel('2026-10-05', 'day', 'en-US')).toBe('10/05')
    expect(axisLabel('2027-01-01', 'month', 'en-US')).toBe('Jan/27')
  })
})
