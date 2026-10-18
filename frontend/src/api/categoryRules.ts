import { apiRequest } from './client'
import type { CategoryRule, CategoryRuleRequest } from './types'

export function listCategoryRules(signal?: AbortSignal): Promise<CategoryRule[]> {
  return apiRequest('/category-rules', { signal })
}

export function createCategoryRule(request: CategoryRuleRequest): Promise<CategoryRule> {
  return apiRequest('/category-rules', { method: 'POST', body: request })
}

export function updateCategoryRule(id: number, request: CategoryRuleRequest): Promise<CategoryRule> {
  return apiRequest(`/category-rules/${id}`, { method: 'PUT', body: request })
}

export function deleteCategoryRule(id: number): Promise<void> {
  return apiRequest(`/category-rules/${id}`, { method: 'DELETE' })
}

export function applyCategoryRule(id: number, options: { preview: boolean; includeCategorized: boolean }): Promise<{ count: number }> {
  const params = new URLSearchParams()
  if (options.preview) params.set('preview', 'true')
  if (options.includeCategorized) params.set('includeCategorized', 'true')
  const query = params.toString()
  return apiRequest(`/category-rules/${id}/apply${query ? `?${query}` : ''}`, { method: 'POST' })
}
