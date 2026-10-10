import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  applyCategoryRule, createCategoryRule, deleteCategoryRule, listCategoryRules, updateCategoryRule,
} from '../api/categoryRules'
import type { CategoryRuleRequest } from '../api/types'

export const categoryRuleKeys = {
  all: ['category-rules'] as const,
  preview: (id: number, includeCategorized: boolean) => ['category-rules', 'preview', id, includeCategorized] as const,
}

export function useCategoryRules() {
  return useQuery({
    queryKey: categoryRuleKeys.all,
    queryFn: ({ signal }) => listCategoryRules(signal),
  })
}

function useInvalidateRules() {
  const queryClient = useQueryClient()
  return () => queryClient.invalidateQueries({ queryKey: categoryRuleKeys.all })
}

export function useCreateCategoryRule() {
  const invalidate = useInvalidateRules()
  return useMutation({ mutationFn: (request: CategoryRuleRequest) => createCategoryRule(request), onSuccess: invalidate })
}

export function useUpdateCategoryRule() {
  const invalidate = useInvalidateRules()
  return useMutation({
    mutationFn: ({ id, request }: { id: number; request: CategoryRuleRequest }) => updateCategoryRule(id, request),
    onSuccess: invalidate,
  })
}

export function useDeleteCategoryRule() {
  const invalidate = useInvalidateRules()
  return useMutation({ mutationFn: (id: number) => deleteCategoryRule(id), onSuccess: invalidate })
}

// Quantas movimentações a regra mudaria, antes de confirmar. Sem cache: sempre o número de agora.
export function useCategoryRulePreview(id: number, includeCategorized: boolean) {
  return useQuery({
    queryKey: categoryRuleKeys.preview(id, includeCategorized),
    queryFn: () => applyCategoryRule(id, { preview: true, includeCategorized }),
    gcTime: 0,
    staleTime: 0,
  })
}

// Aplicar muda a categoria de movimentações: a lista, os relatórios e os orçamentos mudam junto.
export function useApplyCategoryRule() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, includeCategorized }: { id: number; includeCategorized: boolean }) =>
      applyCategoryRule(id, { preview: false, includeCategorized }),
    onSuccess: () => Promise.all([
      queryClient.invalidateQueries({ queryKey: ['transactions'] }),
      queryClient.invalidateQueries({ queryKey: ['reports'] }),
      queryClient.invalidateQueries({ queryKey: ['budgets'] }),
    ]),
  })
}
