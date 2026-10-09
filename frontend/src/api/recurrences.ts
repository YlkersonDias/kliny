import { apiRequest } from './client'
import type { Recurrence, RecurrenceCreateRequest, RecurrenceUpdateRequest } from './types'

// Lançamentos recorrentes (8.5a).
export function listRecurrences(signal?: AbortSignal): Promise<Recurrence[]> {
  return apiRequest('/recurrences', { signal })
}

export function createRecurrence(request: RecurrenceCreateRequest): Promise<Recurrence> {
  return apiRequest('/recurrences', { method: 'POST', body: request })
}

export function updateRecurrence(id: number, request: RecurrenceUpdateRequest): Promise<Recurrence> {
  return apiRequest(`/recurrences/${id}`, { method: 'PUT', body: request })
}

export function deleteRecurrence(id: number): Promise<void> {
  return apiRequest(`/recurrences/${id}`, { method: 'DELETE' })
}

// Lança o que falta até o fim do mês de hoje. "today" vem do navegador: o servidor não sabe o fuso.
export function syncRecurrences(today: string): Promise<{ created: number }> {
  return apiRequest('/recurrences/sync', { method: 'POST', body: { today } })
}
