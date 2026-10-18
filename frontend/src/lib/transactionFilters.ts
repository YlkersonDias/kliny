import type { TransactionQuery, TransactionSort, TransactionType } from '../api/types'
import i18n from '../i18n'
import { isValidIsoDate, type DateRange } from './dates'

// Filtros na URL: ?de=2026-10-01&ate=2026-10-31&categoria=3&tipo=gastos&busca=mercado&ordem=maior&pagina=2
// Parâmetro ausente = valor padrão; "de=" vazio = sem limite inicial.

export const PAGE_SIZE = 20
const PAGE_MAX = 1_000_000 // mesmo limite da API

export type TypeFilter = '' | 'receitas' | 'gastos' | 'cofres'
// '' = mais recentes primeiro (o padrão da API).
export type SortFilter = '' | 'antigas' | 'maior' | 'menor'

export const SEARCH_MAX = 100

export interface TransactionFilters {
  from: string // '' = sem limite
  to: string
  category: string // '' = todas, 'sem' = sem categoria, ou o Id
  type: TypeFilter
  search: string // como foi digitado; a API ignora os espaços das pontas
  sort: SortFilter
  page: number
}

const TYPE_TO_API: Record<Exclude<TypeFilter, ''>, TransactionType> = {
  receitas: 'income',
  gastos: 'expense',
  cofres: 'vault',
}

const SORT_TO_API: Record<Exclude<SortFilter, ''>, TransactionSort> = {
  antigas: 'date-asc',
  maior: 'amount-desc',
  menor: 'amount-asc',
}

export function parsePage(value: string | null): number {
  const page = Number(value ?? '1')
  return Number.isInteger(page) && page >= 1 && page <= PAGE_MAX ? page : 1
}

function parseDate(params: URLSearchParams, key: string, fallback: string): string {
  const value = params.get(key)
  if (value === null) return fallback
  if (value === '') return ''
  return isValidIsoDate(value) ? value : fallback
}

export function parseFilters(params: URLSearchParams, defaultRange: DateRange): TransactionFilters {
  const type = params.get('tipo') ?? ''
  const category = params.get('categoria') ?? ''
  const sort = params.get('ordem') ?? ''
  const filters: TransactionFilters = {
    from: parseDate(params, 'de', defaultRange.from),
    to: parseDate(params, 'ate', defaultRange.to),
    category: category === 'sem' || /^[1-9]\d{0,9}$/.test(category) ? category : '',
    type: Object.hasOwn(TYPE_TO_API, type) ? (type as TypeFilter) : '',
    search: (params.get('busca') ?? '').slice(0, SEARCH_MAX),
    sort: Object.hasOwn(SORT_TO_API, sort) ? (sort as SortFilter) : '',
    page: parsePage(params.get('pagina')),
  }
  // Operações de cofre não têm categoria (e a API recusa "sem" com tipo=cofres).
  if (filters.type === 'cofres') filters.category = ''
  return filters
}

export function filtersToParams(filters: TransactionFilters, defaultRange: DateRange): URLSearchParams {
  const params = new URLSearchParams()
  if (filters.from !== defaultRange.from) params.set('de', filters.from)
  if (filters.to !== defaultRange.to) params.set('ate', filters.to)
  if (filters.category && filters.type !== 'cofres') params.set('categoria', filters.category)
  if (filters.type) params.set('tipo', filters.type)
  if (filters.search.trim()) params.set('busca', filters.search)
  if (filters.sort) params.set('ordem', filters.sort)
  if (filters.page > 1) params.set('pagina', String(filters.page))
  return params
}

export function toQuery(filters: TransactionFilters): TransactionQuery {
  return {
    from: filters.from || undefined,
    to: filters.to || undefined,
    categoryId: /^\d+$/.test(filters.category) ? Number(filters.category) : undefined,
    uncategorized: filters.category === 'sem' || undefined,
    type: filters.type ? TYPE_TO_API[filters.type] : undefined,
    search: filters.search.trim() || undefined,
    sort: filters.sort ? SORT_TO_API[filters.sort] : undefined,
    page: filters.page,
    pageSize: PAGE_SIZE,
  }
}

export function isDefaultPeriod(filters: TransactionFilters, defaultRange: DateRange): boolean {
  return filters.from === defaultRange.from && filters.to === defaultRange.to
}

// A ordem não conta como filtro.
export function hasOtherFilters(filters: TransactionFilters): boolean {
  return filters.category !== '' || filters.type !== '' || filters.search.trim() !== ''
}

export function rangeError(filters: TransactionFilters): string | undefined {
  if (filters.from && filters.to && filters.from > filters.to) return i18n.t('validation.rangeInverted')
  return undefined
}
