import type { Category } from '../api/types'

// As mesmas chaves do backend (DTOs/Categories/CategoryAppearance.cs). A cor vira o token --color-cat-<chave>.

export const CATEGORY_COLORS = ['blue', 'indigo', 'purple', 'pink', 'orange', 'amber', 'teal', 'green', 'brown', 'gray'] as const
export type CategoryColor = (typeof CATEGORY_COLORS)[number]

export const CATEGORY_ICONS = [
  'cart', 'home', 'car', 'bus', 'food', 'coffee', 'health', 'education', 'leisure', 'gift', 'pets', 'clothes',
  'salary', 'invest', 'travel', 'bills', 'phone', 'streaming', 'gym', 'beauty', 'baby', 'tools', 'savings', 'tag',
] as const
export type CategoryIconName = (typeof CATEGORY_ICONS)[number]

export const DEFAULT_COLOR: CategoryColor = 'gray'
export const DEFAULT_ICON: CategoryIconName = 'tag'

export interface CategoryLook {
  color: CategoryColor
  icon: CategoryIconName
}

// Valor desconhecido (de uma versão futura, por exemplo) vale o padrão, em vez de quebrar a tela.
export function categoryLook(category: Pick<Category, 'color' | 'icon'> | null | undefined): CategoryLook {
  const color = CATEGORY_COLORS.find((key) => key === category?.color) ?? DEFAULT_COLOR
  const icon = CATEGORY_ICONS.find((key) => key === category?.icon) ?? DEFAULT_ICON
  return { color, icon }
}

export const categoryColorVar = (color: CategoryColor) => `var(--color-cat-${color})`
