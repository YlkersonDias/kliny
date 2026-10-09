import { apiRequest } from './client'
import type { Budget } from './types'

// Orçamento por categoria (8.2). O mês ("2026-10") vem do navegador: a API não escolhe período.
export function listBudgets(month: string, signal?: AbortSignal): Promise<Budget[]> {
  return apiRequest(`/budgets?month=${encodeURIComponent(month)}`, { signal })
}

export function setBudget(categoryId: number, amount: number): Promise<{ categoryId: number; limit: number }> {
  return apiRequest(`/budgets/${categoryId}`, { method: 'PUT', body: { amount } })
}

export function deleteBudget(categoryId: number): Promise<void> {
  return apiRequest(`/budgets/${categoryId}`, { method: 'DELETE' })
}
