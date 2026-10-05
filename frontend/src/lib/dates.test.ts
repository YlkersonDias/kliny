import { afterEach, describe, expect, it, vi } from 'vitest'
import { currentMonthRange, formatDate, isValidIsoDate, today, toIsoDate } from './dates'

// O vite.config.ts fixa o fuso dos testes em America/Sao_Paulo (UTC-3).
afterEach(() => {
  vi.useRealTimers()
})

describe('fuso dos testes', () => {
  it('está em UTC-3', () => {
    expect(new Date(2026, 9, 5).getTimezoneOffset()).toBe(180)
  })
})

describe('today', () => {
  it('usa a data local, e não a UTC', () => {
    // 23h30 de 31/01 no Brasil já é 01/02 em UTC.
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 0, 31, 23, 30))
    expect(new Date().toISOString().slice(0, 10)).toBe('2026-02-01')
    expect(today()).toBe('2026-01-31')
  })

  it('preenche dia e mês com zero', () => {
    expect(toIsoDate(new Date(2026, 2, 5))).toBe('2026-03-05')
  })
})

describe('currentMonthRange', () => {
  it.each([
    [new Date(2026, 9, 5), '2026-10-01', '2026-10-31'],
    [new Date(2026, 8, 30, 23, 59), '2026-09-01', '2026-09-30'],
    [new Date(2026, 1, 10), '2026-02-01', '2026-02-28'],
    [new Date(2028, 1, 10), '2028-02-01', '2028-02-29'],
    [new Date(2100, 1, 10), '2100-02-01', '2100-02-28'],
    [new Date(2000, 1, 10), '2000-02-01', '2000-02-29'],
    [new Date(2026, 11, 31, 23, 30), '2026-12-01', '2026-12-31'],
  ])('mês de %s', (now, from, to) => {
    expect(currentMonthRange(now)).toEqual({ from, to })
  })

  it('usa o relógio quando não recebe data', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2027, 0, 1, 0, 5))
    expect(currentMonthRange()).toEqual({ from: '2027-01-01', to: '2027-01-31' })
  })
})

describe('isValidIsoDate', () => {
  it.each(['2026-10-02', '2028-02-29', '2000-02-29', '0001-01-01', '9999-12-31'])('aceita %s', (text) => {
    expect(isValidIsoDate(text)).toBe(true)
  })

  it.each(['', '2026-13-01', '2026-00-10', '2026-02-29', '2100-02-29', '2026-04-31', '0000-01-01', '02/10/2026', '2026-1-2'])(
    'recusa "%s"',
    (text) => {
      expect(isValidIsoDate(text)).toBe(false)
    },
  )
})

describe('formatDate', () => {
  it('mostra no formato brasileiro sem mudar o dia', () => {
    expect(formatDate('2026-10-02')).toBe('02/10/2026')
    expect(formatDate('2027-01-01')).toBe('01/01/2027')
  })

  it('devolve texto inválido sem mexer', () => {
    expect(formatDate('ontem')).toBe('ontem')
  })
})
