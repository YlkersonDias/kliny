import { apiRequest } from './client'
import type { AuthResponse, LoginRequest, RegisterRequest, User } from './types'

export function register(request: RegisterRequest): Promise<AuthResponse> {
  return apiRequest('/auth/register', { method: 'POST', body: request, auth: false })
}

export function login(request: LoginRequest): Promise<AuthResponse> {
  return apiRequest('/auth/login', { method: 'POST', body: request, auth: false })
}

export function me(signal?: AbortSignal): Promise<User> {
  return apiRequest('/auth/me', { signal })
}

// Exclui a conta e todos os dados, de forma irreversível. Exige a senha atual.
export function deleteAccount(password: string): Promise<void> {
  return apiRequest('/auth/delete-account', { method: 'POST', body: { password } })
}

// "Sair de todos os dispositivos" (S.5): a API invalida todos os tokens do usuário, inclusive este.
export function logoutAll(): Promise<void> {
  return apiRequest('/auth/logout-all', { method: 'POST' })
}
