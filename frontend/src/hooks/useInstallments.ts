import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createInstallment, deleteInstallment, listInstallments } from '../api/installments'
import type { InstallmentCreateRequest } from '../api/types'
import { today } from '../lib/dates'

export const installmentKeys = {
  all: ['installments'] as const,
  list: (day: string) => ['installments', day] as const,
}

export function useInstallments() {
  const day = today()
  return useQuery({
    queryKey: installmentKeys.list(day),
    queryFn: ({ signal }) => listInstallments(day, signal),
  })
}

// As parcelas são movimentações: mudam também a lista, os relatórios e os orçamentos.
function useInvalidateAfterChange() {
  const queryClient = useQueryClient()
  return () => Promise.all([
    queryClient.invalidateQueries({ queryKey: installmentKeys.all }),
    queryClient.invalidateQueries({ queryKey: ['transactions'] }),
    queryClient.invalidateQueries({ queryKey: ['reports'] }),
    queryClient.invalidateQueries({ queryKey: ['budgets'] }),
  ])
}

export function useCreateInstallment() {
  const invalidate = useInvalidateAfterChange()
  return useMutation({
    mutationFn: (request: InstallmentCreateRequest) => createInstallment(request, today()),
    onSuccess: invalidate,
  })
}

export function useDeleteInstallment() {
  const invalidate = useInvalidateAfterChange()
  return useMutation({
    mutationFn: ({ id, scope }: { id: number; scope: 'all' | 'future' }) => deleteInstallment(id, scope, today()),
    onSuccess: invalidate,
  })
}
