import type { CategoryTotal } from '../api/types'
import i18n, { currentLanguage } from '../i18n'
import { categoryColorVar, DEFAULT_COLOR, DEFAULT_ICON, type CategoryLook } from './categoryAppearance'
import type { Language } from './language'

// Fatias do gráfico de rosca por categoria. A API já manda do maior total para o menor.
// No máximo 7 fatias: com mais categorias, as 6 maiores e "Outras", que soma o resto.

export const MAX_SLICES = 7

const toCents = (value: number) => Math.round(value * 100)

const PERCENT: Record<Language, Intl.NumberFormat> = {
  'pt-BR': new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }),
  'en-US': new Intl.NumberFormat('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 }),
}

// Percentual com uma casa, sem o "%" (fica no texto traduzido): 12,5 ou 12.5.
export function formatPercent(value: number, language: Language = currentLanguage()): string {
  return PERCENT[language].format(value)
}

export interface CategorySlice {
  key: string
  name: string
  total: number
  count: number
  // Sobre o total do período, com 1 casa; a soma pode não dar exatamente 100.
  percentage: number
  // Posição de 1 a 7, igual ao número do selo e da legenda.
  rank: number
  // A cor da categoria (ou, sem lookOf, o token da escala pela posição); "Outras" usa hachura.
  color: string
  // Cor e ícone da categoria, para a legenda (cinza e etiqueta sem categoria; nulo em "Outras").
  look: CategoryLook | null
  isOther: boolean
  isUncategorized: boolean
  // Quantas categorias "Outras" junta (0 nas demais).
  groupedCount: number
}

function percentage(cents: number, totalCents: number): number {
  return totalCents === 0 ? 0 : Math.round((cents * 1000) / totalCents) / 10
}

// lookOf: a cor e o ícone de cada categoria (pelo Id). Sem ele, a escala lilás pela posição.
export function toSlices(rows: CategoryTotal[], lookOf?: (categoryId: number) => CategoryLook | undefined): CategorySlice[] {
  const sorted = [...rows].sort((a, b) => b.total - a.total)
  const totalCents = sorted.reduce((sum, row) => sum + toCents(row.total), 0)
  const visible = sorted.length <= MAX_SLICES ? sorted : sorted.slice(0, MAX_SLICES - 1)

  const slices: CategorySlice[] = visible.map((row, index) => {
    const look = (row.categoryId === null ? undefined : lookOf?.(row.categoryId)) ?? { color: DEFAULT_COLOR, icon: DEFAULT_ICON }
    return {
    key: row.categoryId === null ? 'sem-categoria' : String(row.categoryId),
    name: categoryName(row),
    total: row.total,
    count: row.count,
    percentage: percentage(toCents(row.total), totalCents),
    rank: index + 1,
    color: lookOf ? categoryColorVar(look.color) : `var(--color-category-${index + 1})`,
    look,
    isOther: false,
    isUncategorized: row.categoryId === null,
    groupedCount: 0,
    }
  })

  if (sorted.length > MAX_SLICES) {
    const rest = sorted.slice(MAX_SLICES - 1)
    const restCents = rest.reduce((sum, row) => sum + toCents(row.total), 0)
    slices.push({
      key: 'outras',
      name: i18n.t('reports:category.others', { grouped: rest.length }),
      total: restCents / 100,
      count: rest.reduce((sum, row) => sum + row.count, 0),
      percentage: percentage(restCents, totalCents),
      rank: MAX_SLICES,
      color: 'var(--color-border)',
      look: null,
      isOther: true,
      isUncategorized: false,
      groupedCount: rest.length,
    })
  }
  return slices
}

// Nome exibido de uma linha da tabela completa (que lista todas, sem agrupar).
export function categoryName(row: CategoryTotal): string {
  return row.categoryName ?? i18n.t('uncategorized')
}

export function totalOf(rows: CategoryTotal[]): number {
  return rows.reduce((sum, row) => sum + toCents(row.total), 0) / 100
}
