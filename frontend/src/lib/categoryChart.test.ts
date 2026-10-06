import { describe, expect, it } from 'vitest'
import type { CategoryTotal } from '../api/types'
import { categoryName, formatPercent, toSlices, totalOf } from './categoryChart'

const row = (id: number | null, name: string | null, total: number, count = 1): CategoryTotal => ({
  categoryId: id, categoryName: name, total, count, percentage: 0,
})

const NINE = [
  row(1, 'Moradia', 1200), row(2, 'Alimentação', 820.4, 12), row(3, 'Transporte', 310), row(4, 'Saúde', 180),
  row(5, 'Lazer', 145.5), row(6, 'Educação', 120), row(7, 'Assinaturas', 59.9), row(8, 'Presentes', 40), row(9, 'Pets', 25.6, 2),
]

describe('toSlices', () => {
  it('até 7 categorias: todas, com a cor pela posição', () => {
    const slices = toSlices(NINE.slice(0, 7))
    expect(slices).toHaveLength(7)
    expect(slices.map((slice) => slice.rank)).toEqual([1, 2, 3, 4, 5, 6, 7])
    expect(slices[0].color).toBe('var(--color-category-1)')
    expect(slices[6].color).toBe('var(--color-category-7)')
    expect(slices.some((slice) => slice.isOther)).toBe(false)
  })

  it('mais de 7: as 6 maiores e "Outras" com o resto', () => {
    const slices = toSlices(NINE)
    expect(slices).toHaveLength(7)
    const other = slices[6]
    expect(other).toMatchObject({ name: 'Outras (3)', total: 125.5, count: 4, isOther: true, rank: 7, groupedCount: 3 })
    expect(other.color).toBe('var(--color-border)')
  })

  it('percentual sobre o total, em centavos', () => {
    const slices = toSlices(NINE)
    expect(slices[0].percentage).toBe(41.4) // 1200 / 2901,40
    expect(slices.reduce((sum, slice) => sum + slice.percentage, 0)).toBeCloseTo(100, 0)
  })

  it('"Sem categoria" entra na ordem pelo total', () => {
    const slices = toSlices([row(1, 'Salário', 3500), row(null, null, 420), row(2, 'Freela', 200)])
    expect(slices[1]).toMatchObject({ name: 'Sem categoria', isUncategorized: true, rank: 2, key: 'sem-categoria' })
  })

  it('ordena mesmo se a lista vier fora de ordem; vazia não quebra', () => {
    expect(toSlices([row(1, 'A', 10), row(2, 'B', 30)]).map((slice) => slice.name)).toEqual(['B', 'A'])
    expect(toSlices([])).toEqual([])
  })
})

describe('totalOf e categoryName', () => {
  it('soma em centavos e dá nome à linha sem categoria', () => {
    expect(totalOf([row(1, 'A', 0.1), row(2, 'B', 0.2)])).toBe(0.3)
    expect(categoryName(row(null, null, 1))).toBe('Sem categoria')
  })
})

describe('formatPercent', () => {
  it('uma casa, com o separador do idioma', () => {
    expect(formatPercent(12.345, 'pt-BR')).toBe('12,3')
    expect(formatPercent(12.345, 'en-US')).toBe('12.3')
    expect(formatPercent(100, 'en-US')).toBe('100.0')
  })
})
