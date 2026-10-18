import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { deleteBudget, listBudgets, setBudget } from '../api/budgets'
import type { Budget } from '../api/types'
import { currentLanguage } from '../i18n'

export const budgetKeys = {
  all: ['budgets'] as const,
  month: (month: string) => ['budgets', month] as const,
}

function sortByName(budgets: Budget[]): Budget[] {
  return [...budgets].sort((a, b) => a.categoryName.localeCompare(b.categoryName, currentLanguage()))
}

export function useBudgets(month: string) {
  return useQuery({
    queryKey: budgetKeys.month(month),
    queryFn: ({ signal }) => listBudgets(month, signal),
    select: sortByName,
  })
}

export interface BudgetChange {
  categoryId: number
  amount: number | null
}

export function useSaveBudgets() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (changes: BudgetChange[]) => {
      for (const change of changes) {
        if (change.amount === null) await deleteBudget(change.categoryId)
        else await setBudget(change.categoryId, change.amount)
      }
    },
    // Se uma falhar no meio, as anteriores já foram gravadas.
    onSettled: () => queryClient.invalidateQueries({ queryKey: budgetKeys.all }),
  })
}
