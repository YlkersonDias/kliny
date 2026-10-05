import { apiRequest } from './client'
import type { Vault, VaultOperationRequest, VaultOperationResponse, VaultRequest } from './types'

export function listVaults(signal?: AbortSignal): Promise<Vault[]> {
  return apiRequest('/vaults', { signal })
}

export function getVault(id: number, signal?: AbortSignal): Promise<Vault> {
  return apiRequest(`/vaults/${id}`, { signal })
}

export function createVault(request: VaultRequest): Promise<Vault> {
  return apiRequest('/vaults', { method: 'POST', body: request })
}

export function updateVault(id: number, request: VaultRequest): Promise<Vault> {
  return apiRequest(`/vaults/${id}`, { method: 'PUT', body: request })
}

// Só com saldo zero. Irreversível: apaga também os depósitos e retiradas do cofre.
export function deleteVault(id: number): Promise<void> {
  return apiRequest(`/vaults/${id}`, { method: 'DELETE' })
}

export function depositToVault(id: number, request: VaultOperationRequest): Promise<VaultOperationResponse> {
  return apiRequest(`/vaults/${id}/deposit`, { method: 'POST', body: request })
}

export function withdrawFromVault(id: number, request: VaultOperationRequest): Promise<VaultOperationResponse> {
  return apiRequest(`/vaults/${id}/withdraw`, { method: 'POST', body: request })
}
