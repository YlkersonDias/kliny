import type { ReportPeriod, TimelineGrouping } from '../api/types'
import i18n from '../i18n'
import { currentMonthRange, isValidIsoDate, toIsoDate } from './dates'

// Período dos Relatórios, guardado na URL (?periodo=&de=&ate=&agrupar=&tipo=).

export type PeriodPreset = 'este-mes' | 'mes-passado' | 'este-ano' | 'personalizado'

export const PRESETS: PeriodPreset[] = ['este-mes', 'mes-passado', 'este-ano', 'personalizado']

// Mesmos limites da API.
export const MAX_YEARS = 10
export const MAX_DAYS_BY_DAY = 366
export const AUTO_DAY_LIMIT = 62

const pad = (value: number, length = 2) => String(value).padStart(length, '0')

function parts(iso: string): [number, number, number] {
  return [Number(iso.slice(0, 4)), Number(iso.slice(5, 7)), Number(iso.slice(8, 10))]
}

function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0
}

// Igual ao DateOnly.AddYears do .NET: 29/02 num ano que não é bissexto vira 28/02.
export function addYears(iso: string, years: number): string {
  const [year, month, day] = parts(iso)
  const target = year + years
  const fixedDay = month === 2 && day === 29 && !isLeapYear(target) ? 28 : day
  return `${pad(target, 4)}-${pad(month)}-${pad(fixedDay)}`
}

// Como o DayNumber do .NET, sem o problema de anos 0 a 99 do Date.
function dayNumber(iso: string): number {
  const [year, month, day] = parts(iso)
  const date = new Date(Date.UTC(2000, month - 1, day))
  date.setUTCFullYear(year)
  return Math.round(date.getTime() / 86_400_000)
}

export function daysInclusive({ from, to }: ReportPeriod): number {
  return dayNumber(to) - dayNumber(from) + 1
}

export function presetRange(preset: Exclude<PeriodPreset, 'personalizado'>, now: Date = new Date()): ReportPeriod {
  if (preset === 'este-mes') return currentMonthRange(now)
  if (preset === 'mes-passado') return currentMonthRange(new Date(now.getFullYear(), now.getMonth() - 1, 1))
  const year = toIsoDate(now).slice(0, 4)
  return { from: `${year}-01-01`, to: `${year}-12-31` }
}

// Na ordem em que a API confere. undefined = válido.
export function periodError({ from, to }: ReportPeriod): string | undefined {
  if (!from || !to) return i18n.t('reports:period.bothDates')
  if (!isValidIsoDate(from) || !isValidIsoDate(to)) return i18n.t('validation.dateInvalid')
  if (from > to) return i18n.t('validation.rangeInverted')
  // Nos últimos 10 anos do calendário a API não confere (AddYears estouraria).
  if (Number(from.slice(0, 4)) <= 9999 - MAX_YEARS && to > addYears(from, MAX_YEARS)) {
    return i18n.t('reports:period.maxYears', { max: MAX_YEARS })
  }
  return undefined
}

export function resolveGrouping(period: ReportPeriod, chosen: TimelineGrouping | null): {
  grouping: TimelineGrouping
  dayAllowed: boolean
} {
  const days = daysInclusive(period)
  const dayAllowed = days <= MAX_DAYS_BY_DAY
  if (chosen === 'day' && dayAllowed) return { grouping: 'day', dayAllowed }
  if (chosen === 'month') return { grouping: 'month', dayAllowed }
  return { grouping: dayAllowed && days <= AUTO_DAY_LIMIT ? 'day' : 'month', dayAllowed }
}

export interface ReportFilters {
  preset: PeriodPreset
  period: ReportPeriod
  grouping: TimelineGrouping | null // null = automático
  type: 'expense' | 'income'
}

export function parseReportFilters(params: URLSearchParams, now: Date = new Date()): ReportFilters {
  const raw = params.get('periodo')
  const preset: PeriodPreset = PRESETS.includes(raw as PeriodPreset) ? (raw as PeriodPreset) : 'este-mes'
  const fallback = presetRange('este-mes', now)
  const period = preset === 'personalizado'
    ? { from: params.get('de') ?? fallback.from, to: params.get('ate') ?? fallback.to }
    : presetRange(preset, now)
  const agrupar = params.get('agrupar')
  return {
    preset,
    period,
    grouping: agrupar === 'dia' ? 'day' : agrupar === 'mes' ? 'month' : null,
    type: params.get('tipo') === 'receitas' ? 'income' : 'expense',
  }
}

export function reportFiltersToParams(filters: ReportFilters): URLSearchParams {
  const params = new URLSearchParams()
  if (filters.preset !== 'este-mes') params.set('periodo', filters.preset)
  if (filters.preset === 'personalizado') {
    params.set('de', filters.period.from)
    params.set('ate', filters.period.to)
  }
  if (filters.grouping) params.set('agrupar', filters.grouping === 'day' ? 'dia' : 'mes')
  if (filters.type === 'income') params.set('tipo', 'receitas')
  return params
}
