import { describe, expect, it } from 'vitest'
import { dayOfMonth, recurrenceStatus } from './recurrences'

describe('recurrenceStatus', () => {
  it('ativa sem data final ou antes dela', () => {
    expect(recurrenceStatus({ paused: false, endDate: null, nextDate: '2026-11-05' })).toBe('active')
    expect(recurrenceStatus({ paused: false, endDate: '2026-11-05', nextDate: '2026-11-05' })).toBe('active')
  })

  it('pausada', () => {
    expect(recurrenceStatus({ paused: true, endDate: null, nextDate: '2026-11-05' })).toBe('paused')
  })

  it('terminada quando a próxima passa da data final, mesmo pausada', () => {
    expect(recurrenceStatus({ paused: false, endDate: '2026-11-04', nextDate: '2026-11-05' })).toBe('ended')
    expect(recurrenceStatus({ paused: true, endDate: '2026-10-31', nextDate: '2026-11-05' })).toBe('ended')
  })
})

describe('dayOfMonth', () => {
  it('lê o dia sem fuso', () => {
    expect(dayOfMonth('2026-10-01')).toBe(1)
    expect(dayOfMonth('2026-01-31')).toBe(31)
  })
})
