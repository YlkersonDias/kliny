import { currentLanguage } from '../i18n'
import type { Language } from './language'
import { MONEY_MAX, parseMoneyInput } from './money'

// Simulador de aportes: só uma conta com os valores que a pessoa digita. Nada é sugerido, guardado
// ou enviado à API. O saldo rende a taxa do mês e, no fim do mês, recebe o aporte, o mesmo que
// M = P·(1 + r)^n + A·((1 + r)^n − 1) / r.

export type RateUnit = 'month' | 'year'
export type TermUnit = 'month' | 'year'

// Limites para a conta continuar fazendo sentido (e caber no number do JavaScript).
export const SIMULATOR_MAX_MONTHS = 600
export const SIMULATOR_MAX_RATE: Record<RateUnit, number> = { month: 20, year: 500 }
// Até 24 meses, um ponto por mês; acima, um por ano (e o último mês, se o prazo não fecha um ano).
const MONTHLY_POINTS_UP_TO = 24

export interface SimulatorInput {
  initial: number
  monthly: number
  // Em %, na unidade de rateUnit.
  rate: number
  rateUnit: RateUnit
  months: number
}

export interface SimulationPoint {
  month: number
  contributed: number
  total: number
}

export type SimulationResult =
  | { ok: true; points: SimulationPoint[]; byMonth: boolean; total: number; contributed: number; growth: number }
  | { ok: false; reason: 'tooLarge' }

// Taxa mensal em decimal. Ao ano, a equivalente composta: (1 + a)^(1/12) − 1.
export function monthlyRate(rate: number, unit: RateUnit): number {
  const decimal = rate / 100
  return unit === 'month' ? decimal : (1 + decimal) ** (1 / 12) - 1
}

export function simulate({ initial, monthly, rate, rateUnit, months }: SimulatorInput): SimulationResult {
  const r = monthlyRate(rate, rateUnit)
  const byMonth = months <= MONTHLY_POINTS_UP_TO
  const points: SimulationPoint[] = []
  let total = initial
  for (let month = 1; month <= months; month++) {
    total = total * (1 + r) + monthly
    if (!Number.isFinite(total) || total > MONEY_MAX) return { ok: false, reason: 'tooLarge' }
    if (byMonth || month % 12 === 0 || month === months)
      points.push({ month, contributed: initial + monthly * month, total })
  }
  const contributed = initial + monthly * months
  return { ok: true, points, byMonth, total, contributed, growth: total - contributed }
}

const PERCENT_PATTERN: Record<Language, RegExp> = {
  'pt-BR': /^(\d{1,3})(?:,(\d{1,4}))?$/,
  'en-US': /^(\d{1,3})(?:\.(\d{1,4}))?$/,
}

// "0,9" (ou "0.9" em inglês), com ou sem "%". Até 4 casas. Devolve null se não for uma taxa.
export function parsePercentInput(text: string, language: Language = currentLanguage()): number | null {
  const match = PERCENT_PATTERN[language].exec(text.trim().replace(/\s*%$/, ''))
  if (!match) return null
  return Number(`${match[1]}.${match[2] ?? '0'}`)
}

export interface SimulatorForm {
  initial: string
  monthly: string
  rate: string
  rateUnit: RateUnit
  term: string
  termUnit: TermUnit
}

export type SimulatorField = 'initial' | 'monthly' | 'rate' | 'term'
export type SimulatorError = 'invalidMoney' | 'invalidRate' | 'rateTooHigh' | 'invalidTerm' | 'termTooLong'

export type SimulatorParse =
  | { status: 'ready'; input: SimulatorInput }
  // Falta a taxa, o prazo, ou algum valor (capital ou aporte): nada a mostrar ainda.
  | { status: 'incomplete'; errors: Partial<Record<SimulatorField, SimulatorError>> }
  | { status: 'invalid'; errors: Partial<Record<SimulatorField, SimulatorError>> }

// Campos vazios não são erro: o capital e o aporte vazios valem zero, e sem taxa ou prazo a tela só
// espera. Erro é texto que não é valor, taxa acima do limite ou prazo fora de 1 a 50 anos.
export function parseSimulatorForm(form: SimulatorForm, language: Language = currentLanguage()): SimulatorParse {
  const errors: Partial<Record<SimulatorField, SimulatorError>> = {}

  const money = (field: 'initial' | 'monthly') => {
    if (!form[field].trim()) return 0
    const value = parseMoneyInput(form[field], language)
    if (value === null) errors[field] = 'invalidMoney'
    return value ?? 0
  }
  const initial = money('initial')
  const monthly = money('monthly')

  let rate: number | null = null
  if (form.rate.trim()) {
    rate = parsePercentInput(form.rate, language)
    if (rate === null) errors.rate = 'invalidRate'
    else if (rate > SIMULATOR_MAX_RATE[form.rateUnit]) errors.rate = 'rateTooHigh'
  }

  let months: number | null = null
  if (form.term.trim()) {
    const term = /^\d{1,3}$/.test(form.term.trim()) ? Number(form.term.trim()) : NaN
    const total = form.termUnit === 'year' ? term * 12 : term
    if (!Number.isInteger(total) || total < 1) errors.term = 'invalidTerm'
    else if (total > SIMULATOR_MAX_MONTHS) errors.term = 'termTooLong'
    else months = total
  }

  if (Object.keys(errors).length > 0) return { status: 'invalid', errors }
  if (rate === null || months === null || (initial === 0 && monthly === 0)) return { status: 'incomplete', errors }
  return { status: 'ready', input: { initial, monthly, rate, rateUnit: form.rateUnit, months } }
}
