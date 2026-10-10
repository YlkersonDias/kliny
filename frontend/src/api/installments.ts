import { apiRequest } from './client'
import type { InstallmentCreateRequest, InstallmentPlan } from './types'

// Compras parceladas (8.5b). "today" vem do navegador: a API conta e apaga as parcelas depois dele.
export function listInstallments(today: string, signal?: AbortSignal): Promise<InstallmentPlan[]> {
  return apiRequest(`/installments?today=${encodeURIComponent(today)}`, { signal })
}

export function createInstallment(request: InstallmentCreateRequest, today: string): Promise<InstallmentPlan> {
  return apiRequest(`/installments?today=${encodeURIComponent(today)}`, { method: 'POST', body: request })
}

// "all": todas as parcelas; "future": só as com data depois de hoje.
export function deleteInstallment(id: number, scope: 'all' | 'future', today: string): Promise<void> {
  return apiRequest(`/installments/${id}?scope=${scope}&today=${encodeURIComponent(today)}`, { method: 'DELETE' })
}
