import { describe, expect, it } from 'vitest'
import { filtersToParams, parseFilters, rangeError, toQuery, type TransactionFilters } from './transactionFilters'

const MONTH = { from: '2026-10-01', to: '2026-10-31' }
const parse = (query: string) => parseFilters(new URLSearchParams(query), MONTH)

describe('parseFilters', () => {
  it('sem parâmetros usa o mês atual', () => {
    expect(parse('')).toEqual({ from: '2026-10-01', to: '2026-10-31', category: '', type: '', page: 1 })
  })

  it('lê os filtros da URL', () => {
    expect(parse('de=2026-01-01&ate=2026-03-31&categoria=7&tipo=gastos&pagina=3'))
      .toEqual({ from: '2026-01-01', to: '2026-03-31', category: '7', type: 'gastos', page: 3 })
  })

  it('"de=" vazio é sem limite, e não o padrão', () => {
    expect(parse('de=&ate=').from).toBe('')
    expect(parse('de=&ate=').to).toBe('')
  })

  it('ignora valores inválidos', () => {
    expect(parse('de=2026-02-30&categoria=abc&tipo=todos&pagina=-1'))
      .toEqual({ from: '2026-10-01', to: '2026-10-31', category: '', type: '', page: 1 })
    expect(parse('pagina=1.5').page).toBe(1)
    expect(parse('pagina=9999999').page).toBe(1)
    expect(parse('categoria=0').category).toBe('')
    expect(parse('tipo=toString').type).toBe('')
  })

  it('aceita "sem categoria"', () => {
    expect(parse('categoria=sem').category).toBe('sem')
  })

  it('cofres descarta a categoria', () => {
    expect(parse('categoria=sem&tipo=cofres').category).toBe('')
  })
})

describe('filtersToParams', () => {
  it('omite o que é padrão', () => {
    expect(filtersToParams(parse(''), MONTH).toString()).toBe('')
  })

  it('volta para os mesmos filtros', () => {
    for (const query of ['de=2026-01-01&ate=2026-03-31&categoria=7&tipo=gastos&pagina=3', 'de=&categoria=sem', 'tipo=cofres']) {
      const filters = parse(query)
      expect(parseFilters(filtersToParams(filters, MONTH), MONTH)).toEqual(filters)
    }
  })
})

describe('toQuery', () => {
  const base: TransactionFilters = { from: '2026-10-01', to: '2026-10-31', category: '', type: '', page: 1 }

  it('traduz para os nomes da API', () => {
    expect(toQuery({ ...base, category: '7', type: 'receitas', page: 2 })).toEqual({
      from: '2026-10-01', to: '2026-10-31', categoryId: 7, uncategorized: undefined, type: 'income', page: 2, pageSize: 20,
    })
  })

  it('"sem" vira uncategorized', () => {
    expect(toQuery({ ...base, category: 'sem' })).toMatchObject({ categoryId: undefined, uncategorized: true })
  })

  it('período vazio não vai para a API', () => {
    expect(toQuery({ ...base, from: '', to: '' })).toMatchObject({ from: undefined, to: undefined })
  })
})

describe('rangeError', () => {
  it('recusa data final antes da inicial', () => {
    expect(rangeError({ from: '2026-10-31', to: '2026-10-01', category: '', type: '', page: 1 })).toBeDefined()
    expect(rangeError({ from: '2026-10-01', to: '2026-10-01', category: '', type: '', page: 1 })).toBeUndefined()
    expect(rangeError({ from: '', to: '2026-10-01', category: '', type: '', page: 1 })).toBeUndefined()
  })
})
