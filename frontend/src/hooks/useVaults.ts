import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  createVault, deleteVault, depositToVault, getVault, listVaults, updateVault, withdrawFromVault,
} from '../api/vaults'
import type { Vault, VaultOperationRequest, VaultRequest } from '../api/types'
import { currentLanguage } from '../i18n'
import { transactionKeys } from './useTransactions'

export const vaultKeys = {
  all: ['vaults'] as const,
  list: ['vaults', 'list'] as const,
  detail: (id: number) => ['vaults', 'detail', id] as const,
}

// A API ordena pela collation do banco; aqui a ordem segue o idioma da tela, como nas categorias.
function sortByName(vaults: Vault[]): Vault[] {
  return [...vaults].sort((a, b) => a.name.localeCompare(b.name, currentLanguage()))
}

// Sem paginação: o GET /api/vaults traz todos os cofres do usuário.
export function useVaults() {
  return useQuery({
    queryKey: vaultKeys.list,
    queryFn: ({ signal }) => listVaults(signal),
    select: sortByName,
  })
}

export function useVault(id: number, { enabled = true }: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: vaultKeys.detail(id),
    queryFn: ({ signal }) => getVault(id, signal),
    enabled,
  })
}

export function useCreateVault() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (request: VaultRequest) => createVault(request),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: vaultKeys.all }),
  })
}

// Renomear muda a descrição padrão só das próximas operações; as gravadas ficam como estão.
export function useUpdateVault() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, request }: { id: number; request: VaultRequest }) => updateVault(id, request),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: vaultKeys.all }),
  })
}

// Depósito e retirada mudam o saldo do cofre, o da conta, o extrato e os relatórios.
function useInvalidateAfterOperation() {
  const queryClient = useQueryClient()
  return () => Promise.all([
    queryClient.invalidateQueries({ queryKey: vaultKeys.all }),
    queryClient.invalidateQueries({ queryKey: transactionKeys.all }),
    queryClient.invalidateQueries({ queryKey: ['reports'] }),
  ])
}

interface VaultOperationVariables {
  id: number
  request: VaultOperationRequest
  idempotencyKey: string
}

export function useDepositToVault() {
  const invalidate = useInvalidateAfterOperation()
  return useMutation({
    mutationFn: ({ id, request, idempotencyKey }: VaultOperationVariables) => depositToVault(id, request, idempotencyKey),
    onSuccess: invalidate,
  })
}

export function useWithdrawFromVault() {
  const invalidate = useInvalidateAfterOperation()
  return useMutation({
    mutationFn: ({ id, request, idempotencyKey }: VaultOperationVariables) => withdrawFromVault(id, request, idempotencyKey),
    onSuccess: invalidate,
  })
}

export function useDeleteVault() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => deleteVault(id),
    // O detalhe é removido, e não invalidado: refazer a busca daria 404 na página que ainda está aberta.
    // As invalidações não são esperadas, para quem chamou sair da página do cofre na mesma hora.
    onSuccess: (_, id) => {
      queryClient.removeQueries({ queryKey: vaultKeys.detail(id) })
      void queryClient.invalidateQueries({ queryKey: vaultKeys.list })
      void queryClient.invalidateQueries({ queryKey: transactionKeys.all })
      void queryClient.invalidateQueries({ queryKey: ['reports'] })
    },
  })
}
