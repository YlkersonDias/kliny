import { ApiError } from '../api/client'
import i18n from '../i18n'
import { splitApiError } from './forms'

export const CATEGORY_NAME_MAX = 100

export function validateCategoryName(name: string): string | undefined {
  const trimmed = name.trim()
  if (!trimmed) return i18n.t('categories:validation.nameRequired')
  if (trimmed.length > CATEGORY_NAME_MAX) return i18n.t('categories:validation.nameMax', { max: CATEGORY_NAME_MAX })
  return undefined
}

// O 409 (nome repetido) vem só em detail, mas pertence ao campo.
export function categoryNameError(error: unknown): { field?: string; form: string | null } {
  if (error instanceof ApiError && error.status === 409) return { field: error.detail, form: null }
  const { fieldErrors, formError } = splitApiError(error, ['name'] as const)
  return { field: fieldErrors.name, form: formError }
}
