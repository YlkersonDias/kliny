import { apiRequest } from './client'
import type { PagedResponse, Transaction, TransactionQuery, TransactionRequest } from './types'

// Só os filtros preenchidos vão para a URL.
function toQueryString(query: TransactionQuery): string {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== null && value !== '' && value !== false) params.set(key, String(value))
  }
  const text = params.toString()
  return text ? `?${text}` : ''
}

export function listTransactions(query: TransactionQuery, signal?: AbortSignal): Promise<PagedResponse<Transaction>> {
  return apiRequest(`/transactions${toQueryString(query)}`, { signal })
}

export function createTransaction(request: TransactionRequest): Promise<Transaction> {
  return apiRequest('/transactions', { method: 'POST', body: request })
}

export function updateTransaction(id: number, request: TransactionRequest): Promise<Transaction> {
  return apiRequest(`/transactions/${id}`, { method: 'PUT', body: request })
}

export function deleteTransaction(id: number): Promise<void> {
  return apiRequest(`/transactions/${id}`, { method: 'DELETE' })
}
