import type { TransactionQuery, TransactionType } from '../api/types'
import { isValidIsoDate, type DateRange } from './dates'

// Filtros da tela de Movimentações, guardados na URL em português:
// ?de=2026-10-01&ate=2026-10-31&categoria=3&tipo=gastos&pagina=2
// Parâmetro ausente = valor padrão; "de=" vazio = sem limite inicial.

export const PAGE_SIZE = 20
const PAGE_MAX = 1_000_000 // mesmo limite da API

export type TypeFilter = '' | 'receitas' | 'gastos' | 'cofres'

export interface TransactionFilters {
  from: string // '' = sem limite
  to: string
  category: string // '' = todas, 'sem' = sem categoria, ou o Id
  type: TypeFilter
  page: number
}

const TYPE_TO_API: Record<Exclude<TypeFilter, ''>, TransactionType> = {
  receitas: 'income',
  gastos: 'expense',
  cofres: 'vault',
}

// "?pagina=": inteiro de 1 a PAGE_MAX; qualquer outra coisa vira 1.
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
  const filters: TransactionFilters = {
    from: parseDate(params, 'de', defaultRange.from),
    to: parseDate(params, 'ate', defaultRange.to),
    category: category === 'sem' || /^[1-9]\d{0,9}$/.test(category) ? category : '',
    type: Object.hasOwn(TYPE_TO_API, type) ? (type as TypeFilter) : '',
    page: parsePage(params.get('pagina')),
  }
  // Operações de cofre não têm categoria: a combinação não faz sentido (e a API recusa "sem").
  if (filters.type === 'cofres') filters.category = ''
  return filters
}

// Só o que difere do padrão vai para a URL.
export function filtersToParams(filters: TransactionFilters, defaultRange: DateRange): URLSearchParams {
  const params = new URLSearchParams()
  if (filters.from !== defaultRange.from) params.set('de', filters.from)
  if (filters.to !== defaultRange.to) params.set('ate', filters.to)
  if (filters.category && filters.type !== 'cofres') params.set('categoria', filters.category)
  if (filters.type) params.set('tipo', filters.type)
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
    page: filters.page,
    pageSize: PAGE_SIZE,
  }
}

export function isDefaultPeriod(filters: TransactionFilters, defaultRange: DateRange): boolean {
  return filters.from === defaultRange.from && filters.to === defaultRange.to
}

// Filtros além do período (categoria e tipo).
export function hasOtherFilters(filters: TransactionFilters): boolean {
  return filters.category !== '' || filters.type !== ''
}

export function rangeError(filters: TransactionFilters): string | undefined {
  if (filters.from && filters.to && filters.from > filters.to) return 'A data final não pode ser antes da inicial.'
  return undefined
}
