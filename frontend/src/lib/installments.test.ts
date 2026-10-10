import { describe, expect, it } from 'vitest'
import { addMonthsClamped } from './dates'
import { lastInstallmentDate, parseInstallmentCount, splitInstallments } from './installments'

describe('splitInstallments', () => {
  it('divide em centavos, com a sobra na primeira (como a API)', () => {
    expect(splitInstallments(100, 3)).toEqual({ first: 33.34, each: 33.33 })
    expect(splitInstallments(1500, 10)).toEqual({ first: 150, each: 150 })
    expect(splitInstallments(0.05, 3)).toEqual({ first: 0.03, each: 0.01 })
    expect(splitInstallments(10.01, 2)).toEqual({ first: 5.01, each: 5 })
  })

  it('a soma é sempre o total', () => {
    for (const [total, count] of [[999.99, 7], [0.1, 3], [123456.78, 120], [19.9, 12]] as const) {
      const { first, each } = splitInstallments(total, count)
      expect(Math.round(first * 100) + Math.round(each * 100) * (count - 1)).toBe(Math.round(total * 100))
    }
  })
})

describe('lastInstallmentDate', () => {
  it('uma por mês, no dia da primeira', () => {
    expect(lastInstallmentDate('2026-10-09', 10)).toBe('2027-07-09')
    expect(lastInstallmentDate('2026-01-31', 2)).toBe('2026-02-28')
    expect(lastInstallmentDate('2027-12-31', 3)).toBe('2028-02-29')
  })
})

describe('addMonthsClamped', () => {
  it('mantém o dia e cai no último dia dos meses curtos', () => {
    expect(addMonthsClamped('2026-03-31', 1)).toBe('2026-04-30')
    expect(addMonthsClamped('2026-12-15', 1)).toBe('2027-01-15')
    expect(addMonthsClamped('2026-05-31', 0)).toBe('2026-05-31')
  })
})

describe('parseInstallmentCount', () => {
  it('só inteiros de 2 a 120', () => {
    expect(parseInstallmentCount('10')).toBe(10)
    expect(parseInstallmentCount(' 2 ')).toBe(2)
    expect(parseInstallmentCount('120')).toBe(120)
    expect(parseInstallmentCount('1')).toBeNull()
    expect(parseInstallmentCount('121')).toBeNull()
    expect(parseInstallmentCount('2,5')).toBeNull()
    expect(parseInstallmentCount('')).toBeNull()
    expect(parseInstallmentCount('abc')).toBeNull()
  })
})
