import { apiRequest } from './client'
import type { Category, CategoryRequest } from './types'

export function listCategories(signal?: AbortSignal): Promise<Category[]> {
  return apiRequest('/categories', { signal })
}

export function createCategory(request: CategoryRequest): Promise<Category> {
  return apiRequest('/categories', { method: 'POST', body: request })
}

export function updateCategory(id: number, request: CategoryRequest): Promise<Category> {
  return apiRequest(`/categories/${id}`, { method: 'PUT', body: request })
}

export function deleteCategory(id: number): Promise<void> {
  return apiRequest(`/categories/${id}`, { method: 'DELETE' })
}
