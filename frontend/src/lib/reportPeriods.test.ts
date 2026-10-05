import { describe, expect, it } from 'vitest'
import {
  addYears, daysInclusive, parseReportFilters, periodError, presetRange, reportFiltersToParams, resolveGrouping,
} from './reportPeriods'

const NOW = new Date(2026, 9, 5, 23, 30) // 05/10/2026 às 23h30, hora local

describe('presetRange', () => {
  it('este mês, mês passado e este ano', () => {
    expect(presetRange('este-mes', NOW)).toEqual({ from: '2026-10-01', to: '2026-10-31' })
    expect(presetRange('mes-passado', NOW)).toEqual({ from: '2026-09-01', to: '2026-09-30' })
    expect(presetRange('este-ano', NOW)).toEqual({ from: '2026-01-01', to: '2026-12-31' })
  })

  it('mês passado na virada do ano e em março (fevereiro)', () => {
    expect(presetRange('mes-passado', new Date(2027, 0, 10))).toEqual({ from: '2026-12-01', to: '2026-12-31' })
    expect(presetRange('mes-passado', new Date(2028, 2, 31))).toEqual({ from: '2028-02-01', to: '2028-02-29' })
  })
})

describe('addYears', () => {
  it('igual ao AddYears do .NET', () => {
    expect(addYears('2016-01-01', 10)).toBe('2026-01-01')
    expect(addYears('2024-02-29', 10)).toBe('2034-02-28')
    expect(addYears('2020-02-29', 8)).toBe('2028-02-29')
  })
})

describe('daysInclusive', () => {
  it('conta o primeiro e o último dia', () => {
    expect(daysInclusive({ from: '2026-10-01', to: '2026-10-31' })).toBe(31)
    expect(daysInclusive({ from: '2026-10-05', to: '2026-10-05' })).toBe(1)
    expect(daysInclusive({ from: '2025-01-01', to: '2026-01-01' })).toBe(366)
    expect(daysInclusive({ from: '2028-01-01', to: '2028-12-31' })).toBe(366)
  })

  it('anos de 0 a 99 não viram 19xx', () => {
    expect(daysInclusive({ from: '0050-01-01', to: '0050-01-31' })).toBe(31)
  })
})

describe('periodError', () => {
  it('aceita até 10 anos exatos', () => {
    expect(periodError({ from: '2016-01-01', to: '2026-01-01' })).toBeUndefined()
    expect(periodError({ from: '2016-01-01', to: '2026-01-02' })).toBe('O período deve ter no máximo 10 anos.')
    expect(periodError({ from: '2024-02-29', to: '2034-02-28' })).toBeUndefined()
    expect(periodError({ from: '2024-02-29', to: '2034-03-01' })).toBeDefined()
  })

  it('recusa período invertido, vazio ou inválido', () => {
    expect(periodError({ from: '2026-10-31', to: '2026-10-01' })).toBe('A data final não pode ser antes da inicial.')
    expect(periodError({ from: '', to: '2026-10-01' })).toBe('Informe as duas datas.')
    expect(periodError({ from: '2026-02-30', to: '2026-03-01' })).toBe('Data inválida.')
  })

  it('não confere os 10 anos no fim do calendário, como a API', () => {
    expect(periodError({ from: '9995-01-01', to: '9999-12-31' })).toBeUndefined()
    expect(periodError({ from: '9989-01-01', to: '9999-12-31' })).toBeDefined()
  })
})

describe('resolveGrouping', () => {
  it('automático: por dia até 62 dias, por mês acima', () => {
    expect(resolveGrouping({ from: '2026-10-01', to: '2026-10-31' }, null)).toEqual({ grouping: 'day', dayAllowed: true })
    expect(resolveGrouping({ from: '2026-01-01', to: '2026-12-31' }, null)).toEqual({ grouping: 'month', dayAllowed: true })
  })

  it('a escolha vale, mas "por dia" só até 366 dias', () => {
    expect(resolveGrouping({ from: '2026-01-01', to: '2026-12-31' }, 'day')).toEqual({ grouping: 'day', dayAllowed: true })
    expect(resolveGrouping({ from: '2025-01-01', to: '2026-01-02' }, 'day')).toEqual({ grouping: 'month', dayAllowed: false })
    expect(resolveGrouping({ from: '2026-10-01', to: '2026-10-31' }, 'month').grouping).toBe('month')
  })
})

describe('filtros na URL', () => {
  it('padrão é este mês, gastos, agrupamento automático', () => {
    expect(parseReportFilters(new URLSearchParams(''), NOW)).toEqual({
      preset: 'este-mes', period: { from: '2026-10-01', to: '2026-10-31' }, grouping: null, type: 'expense',
    })
  })

  it('personalizado lê de e ate, e volta igual', () => {
    const params = new URLSearchParams('periodo=personalizado&de=2026-01-15&ate=2026-03-10&agrupar=dia&tipo=receitas')
    const filters = parseReportFilters(params, NOW)
    expect(filters).toEqual({
      preset: 'personalizado', period: { from: '2026-01-15', to: '2026-03-10' }, grouping: 'day', type: 'income',
    })
    expect(reportFiltersToParams(filters).toString()).toBe(params.toString())
  })

  it('valor desconhecido volta ao padrão', () => {
    expect(parseReportFilters(new URLSearchParams('periodo=ontem&tipo=x'), NOW).preset).toBe('este-mes')
  })
})
