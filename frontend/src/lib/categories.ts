import { ApiError } from '../api/client'
import { splitApiError } from './forms'

// Mesma regra do CategoryRequest da API.
export const CATEGORY_NAME_MAX = 100

export function validateCategoryName(name: string): string | undefined {
  const trimmed = name.trim()
  if (!trimmed) return 'Informe o nome da categoria.'
  if (trimmed.length > CATEGORY_NAME_MAX) return `O nome da categoria deve ter no máximo ${CATEGORY_NAME_MAX} caracteres.`
  return undefined
}

// Erro de salvar um nome de categoria: o 409 (nome repetido) vem só em detail,
// mas pertence ao campo, assim como os 400 de validação do campo name.
export function categoryNameError(error: unknown): { field?: string; form: string | null } {
  if (error instanceof ApiError && error.status === 409) return { field: error.detail, form: null }
  const { fieldErrors, formError } = splitApiError(error, ['name'] as const)
  return { field: fieldErrors.name, form: formError }
}
