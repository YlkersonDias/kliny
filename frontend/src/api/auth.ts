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
