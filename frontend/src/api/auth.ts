import { apiRequest } from './client'
import type { AuthResponse, LoginRequest, RegisterRequest, User } from './types'

// A API responde igual com ou sem conta; o link vai por e-mail.
export function register(request: RegisterRequest): Promise<void> {
  return apiRequest('/auth/register', { method: 'POST', body: request, auth: false })
}

export function completeRegistration(token: string, password: string): Promise<AuthResponse> {
  return apiRequest('/auth/register/complete', { method: 'POST', body: { token, password }, auth: false })
}

export function login(request: LoginRequest): Promise<AuthResponse> {
  return apiRequest('/auth/login', { method: 'POST', body: request, auth: false })
}

// A API responde igual com ou sem conta; o link vai por e-mail.
export function forgotPassword(email: string): Promise<void> {
  return apiRequest('/auth/forgot-password', { method: 'POST', body: { email }, auth: false })
}

export function resetPassword(token: string, password: string): Promise<void> {
  return apiRequest('/auth/reset-password', { method: 'POST', body: { token, password }, auth: false })
}

export function me(signal?: AbortSignal): Promise<User> {
  return apiRequest('/auth/me', { signal })
}

export function googleSignIn(credential: string): Promise<AuthResponse> {
  return apiRequest('/auth/google', { method: 'POST', body: { credential }, auth: false })
}

export function linkGoogle(credential: string): Promise<User> {
  return apiRequest('/auth/google/link', { method: 'POST', body: { credential } })
}

export function unlinkGoogle(): Promise<User> {
  return apiRequest('/auth/google/unlink', { method: 'POST' })
}

// Em conta sem senha, um comprovante novo do Google.
export interface DeleteAccountConfirmation {
  password?: string
  googleCredential?: string
}

export function deleteAccount(confirmation: DeleteAccountConfirmation): Promise<void> {
  return apiRequest('/auth/delete-account', { method: 'POST', body: confirmation })
}

export function logoutAll(): Promise<void> {
  return apiRequest('/auth/logout-all', { method: 'POST' })
}
