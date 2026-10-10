import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createTransaction, deleteTransaction, listTransactions, updateTransaction } from '../api/transactions'
import type { TransactionQuery, TransactionRequest } from '../api/types'

export const transactionKeys = {
  all: ['transactions'] as const,
  list: (query: TransactionQuery) => ['transactions', 'list', query] as const,
}

export function useTransactions(query: TransactionQuery, { enabled = true }: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: transactionKeys.list(query),
    queryFn: ({ signal }) => listTransactions(query, signal),
    enabled,
    // Ao trocar de página ou filtro, a lista anterior fica na tela até a nova chegar.
    placeholderData: keepPreviousData,
  })
}

// Movimentações mudam também os relatórios (Dashboard e Relatórios).
export function useInvalidateAfterChange() {
  const queryClient = useQueryClient()
  return () => Promise.all([
    queryClient.invalidateQueries({ queryKey: transactionKeys.all }),
    queryClient.invalidateQueries({ queryKey: ['reports'] }),
    queryClient.invalidateQueries({ queryKey: ['budgets'] }),
  ])
}

export function useCreateTransaction() {
  const invalidate = useInvalidateAfterChange()
  return useMutation({
    mutationFn: (request: TransactionRequest) => createTransaction(request),
    onSuccess: invalidate,
  })
}

export function useUpdateTransaction() {
  const invalidate = useInvalidateAfterChange()
  return useMutation({
    mutationFn: ({ id, request }: { id: number; request: TransactionRequest }) => updateTransaction(id, request),
    onSuccess: invalidate,
  })
}

export function useDeleteTransaction() {
  const invalidate = useInvalidateAfterChange()
  return useMutation({
    mutationFn: (id: number) => deleteTransaction(id),
    onSuccess: invalidate,
  })
}
