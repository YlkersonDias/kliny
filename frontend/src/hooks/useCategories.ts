import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createCategory, deleteCategory, listCategories, updateCategory } from '../api/categories'
import type { Category, CategoryRequest } from '../api/types'
import { currentLanguage } from '../i18n'
import { categoryRuleKeys } from './useCategoryRules'
import { transactionKeys } from './useTransactions'

export const categoryKeys = {
  all: ['categories'] as const,
}

// A ordem segue o idioma da tela, e não a collation do banco.
function sortByName(categories: Category[]): Category[] {
  return [...categories].sort((a, b) => a.name.localeCompare(b.name, currentLanguage()))
}

export function useCategories() {
  return useQuery({
    queryKey: categoryKeys.all,
    queryFn: ({ signal }) => listCategories(signal),
    select: sortByName,
  })
}

export function useCreateCategory() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (request: CategoryRequest) => createCategory(request),
    // Entra no cache na hora: o formulário de movimentação já a mostra selecionada.
    onSuccess: (created) => {
      queryClient.setQueryData<Category[]>(categoryKeys.all, (current) => current && [...current, created])
      return queryClient.invalidateQueries({ queryKey: categoryKeys.all })
    },
  })
}

// Renomear e apagar mudam o nome exibido nas movimentações, no orçamento e nas regras.
export function useUpdateCategory() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, request }: { id: number; request: CategoryRequest }) => updateCategory(id, request),
    onSuccess: () => Promise.all([
      queryClient.invalidateQueries({ queryKey: categoryKeys.all }),
      queryClient.invalidateQueries({ queryKey: transactionKeys.all }),
      queryClient.invalidateQueries({ queryKey: ['budgets'] }),
      queryClient.invalidateQueries({ queryKey: categoryRuleKeys.all }),
    ]),
  })
}

export function useDeleteCategory() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => deleteCategory(id),
    onSuccess: () => Promise.all([
      queryClient.invalidateQueries({ queryKey: categoryKeys.all }),
      queryClient.invalidateQueries({ queryKey: transactionKeys.all }),
      queryClient.invalidateQueries({ queryKey: ['budgets'] }),
      queryClient.invalidateQueries({ queryKey: categoryRuleKeys.all }),
      queryClient.invalidateQueries({ queryKey: ['reports'] }),
    ]),
  })
}
