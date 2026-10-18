import { describe, expect, it } from 'vitest'
import { MONEY_MAX } from './money'
import { monthlyRate, parsePercentInput, parseSimulatorForm, simulate, type SimulatorForm } from './simulator'

// Balanços anuais de uma calculadora de juros compostos de referência.
const DEFAULT = { initial: 50_000, monthly: 2_000, rate: 0.9, rateUnit: 'month' as const, months: 240 }

function ok(result: ReturnType<typeof simulate>) {
  if (!result.ok) throw new Error('esperava uma simulação')
  return result
}

describe('simulate', () => {
  it('confere com os balanços anuais da análise', () => {
    const result = ok(simulate(DEFAULT))
    expect(result.byMonth).toBe(false)
    expect(result.points).toHaveLength(20)
    expect(Math.round(result.points[0].total)).toBe(80_900)
    expect(Math.round(result.points[10].total)).toBe(666_073)
    expect(Math.round(result.points[13].total)).toBe(1_004_199)
    expect(Math.round(result.total)).toBe(2_115_557)
    expect(result.contributed).toBe(530_000)
    expect(result.points[0].contributed).toBe(74_000)
    expect(result.growth).toBeCloseTo(result.total - 530_000, 6)
  })

  it('é a fórmula fechada M = P(1+r)^n + A((1+r)^n − 1)/r', () => {
    const r = 0.009
    const n = 240
    const closed = 50_000 * (1 + r) ** n + 2_000 * (((1 + r) ** n - 1) / r)
    expect(ok(simulate(DEFAULT)).total).toBeCloseTo(closed, 4)
  })

  it('taxa zero só soma o que foi aportado', () => {
    const result = ok(simulate({ ...DEFAULT, rate: 0, months: 36 }))
    expect(result.total).toBe(122_000)
    expect(result.growth).toBe(0)
  })

  it('até 24 meses, um ponto por mês', () => {
    const result = ok(simulate({ ...DEFAULT, months: 6 }))
    expect(result.byMonth).toBe(true)
    expect(result.points.map((point) => point.month)).toEqual([1, 2, 3, 4, 5, 6])
  })

  it('prazo que não fecha um ano guarda também o último mês', () => {
    const result = ok(simulate({ ...DEFAULT, months: 30 }))
    expect(result.points.map((point) => point.month)).toEqual([12, 24, 30])
    expect(result.points.at(-1)?.total).toBe(result.total)
  })

  it('taxa ao ano usa a equivalente mensal composta', () => {
    expect(monthlyRate(12, 'year')).toBeCloseTo(0.0094888, 6)
    expect(ok(simulate({ initial: 1_000, monthly: 0, rate: 12, rateUnit: 'year', months: 12 })).total).toBeCloseTo(1_120, 6)
  })

  it('resultado acima do limite de dinheiro do app não vira número errado', () => {
    expect(simulate({ initial: MONEY_MAX, monthly: 0, rate: 1, rateUnit: 'month', months: 2 })).toEqual({ ok: false, reason: 'tooLarge' })
    expect(simulate({ initial: 1_000_000, monthly: 0, rate: 20, rateUnit: 'month', months: 600 })).toEqual({ ok: false, reason: 'tooLarge' })
  })
})

describe('parsePercentInput', () => {
  it('lê a taxa no formato do idioma', () => {
    expect(parsePercentInput('0,9', 'pt-BR')).toBe(0.9)
    expect(parsePercentInput('12', 'pt-BR')).toBe(12)
    expect(parsePercentInput('1,25 %', 'pt-BR')).toBe(1.25)
    expect(parsePercentInput('0.9', 'en-US')).toBe(0.9)
  })

  it('recusa o que não é taxa', () => {
    expect(parsePercentInput('0.9', 'pt-BR')).toBeNull()
    expect(parsePercentInput('0,9', 'en-US')).toBeNull()
    expect(parsePercentInput('-1', 'pt-BR')).toBeNull()
    expect(parsePercentInput('1,23456', 'pt-BR')).toBeNull()
    expect(parsePercentInput('abc', 'pt-BR')).toBeNull()
  })
})

describe('parseSimulatorForm', () => {
  const form = (patch: Partial<SimulatorForm> = {}): SimulatorForm => ({
    initial: '50.000,00', monthly: '2.000,00', rate: '0,9', rateUnit: 'month', term: '20', termUnit: 'year', ...patch,
  })

  it('pronto com os campos preenchidos', () => {
    expect(parseSimulatorForm(form(), 'pt-BR')).toEqual({ status: 'ready', input: DEFAULT })
  })

  it('capital ou aporte vazios valem zero', () => {
    const result = parseSimulatorForm(form({ initial: '' }), 'pt-BR')
    expect(result.status === 'ready' && result.input.initial).toBe(0)
  })

  it('sem taxa, sem prazo ou sem nenhum valor: só espera, sem erro', () => {
    expect(parseSimulatorForm(form({ rate: '' }), 'pt-BR')).toEqual({ status: 'incomplete', errors: {} })
    expect(parseSimulatorForm(form({ term: '' }), 'pt-BR')).toEqual({ status: 'incomplete', errors: {} })
    expect(parseSimulatorForm(form({ initial: '', monthly: '' }), 'pt-BR')).toEqual({ status: 'incomplete', errors: {} })
  })

  it('erros por campo', () => {
    expect(parseSimulatorForm(form({ initial: 'abc', rate: '1.5' }), 'pt-BR')).toEqual({
      status: 'invalid', errors: { initial: 'invalidMoney', rate: 'invalidRate' },
    })
    expect(parseSimulatorForm(form({ rate: '21' }), 'pt-BR')).toEqual({ status: 'invalid', errors: { rate: 'rateTooHigh' } })
    expect(parseSimulatorForm(form({ rate: '21', rateUnit: 'year' }), 'pt-BR').status).toBe('ready')
    expect(parseSimulatorForm(form({ term: '0' }), 'pt-BR')).toEqual({ status: 'invalid', errors: { term: 'invalidTerm' } })
    expect(parseSimulatorForm(form({ term: '2,5' }), 'pt-BR')).toEqual({ status: 'invalid', errors: { term: 'invalidTerm' } })
    expect(parseSimulatorForm(form({ term: '51' }), 'pt-BR')).toEqual({ status: 'invalid', errors: { term: 'termTooLong' } })
    expect(parseSimulatorForm(form({ term: '600', termUnit: 'month' }), 'pt-BR').status).toBe('ready')
    expect(parseSimulatorForm(form({ term: '601', termUnit: 'month' }), 'pt-BR')).toEqual({ status: 'invalid', errors: { term: 'termTooLong' } })
  })

  it('inglês com o formato do inglês', () => {
    expect(parseSimulatorForm(form({ initial: '50,000.00', monthly: '2,000', rate: '0.9' }), 'en-US')).toEqual({ status: 'ready', input: DEFAULT })
  })
})
