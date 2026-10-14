import { describe, expect, it } from 'vitest'
import { CATEGORY_COLORS, CATEGORY_ICONS, categoryColorVar, categoryLook } from './categoryAppearance'
import { toSlices } from './categoryChart'

describe('categoryLook', () => {
  it('usa a cor e o ícone da categoria', () => {
    expect(categoryLook({ color: 'green', icon: 'cart' })).toEqual({ color: 'green', icon: 'cart' })
  })

  it('sem cor ou ícone, ou desconhecidos, cinza com a etiqueta', () => {
    expect(categoryLook(null)).toEqual({ color: 'gray', icon: 'tag' })
    expect(categoryLook({ color: null, icon: null })).toEqual({ color: 'gray', icon: 'tag' })
    expect(categoryLook({ color: 'red', icon: 'rocket' })).toEqual({ color: 'gray', icon: 'tag' })
  })

  it('as listas têm as mesmas chaves do backend', () => {
    expect(CATEGORY_COLORS).toHaveLength(10)
    expect(CATEGORY_ICONS).toHaveLength(24)
    expect(categoryColorVar('teal')).toBe('var(--color-cat-teal)')
  })
})

describe('toSlices com a cor de cada categoria', () => {
  const rows = [
    { categoryId: 1, categoryName: 'Moradia', total: 300, percentage: 60, count: 1 },
    { categoryId: null, categoryName: null, total: 200, percentage: 40, count: 2 },
  ]

  it('cada fatia na cor da categoria, e sem categoria em cinza', () => {
    const slices = toSlices(rows, (id) => (id === 1 ? { color: 'blue', icon: 'home' } : undefined))
    expect(slices.map((slice) => slice.color)).toEqual(['var(--color-cat-blue)', 'var(--color-cat-gray)'])
    expect(slices.map((slice) => slice.look)).toEqual([{ color: 'blue', icon: 'home' }, { color: 'gray', icon: 'tag' }])
  })

  it('sem a função, a escala lilás pela posição', () => {
    expect(toSlices(rows).map((slice) => slice.color)).toEqual(['var(--color-category-1)', 'var(--color-category-2)'])
  })
})
