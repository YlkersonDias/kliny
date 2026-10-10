import { apiRequest } from './client'
import type { AuthResponse, LoginRequest, RegisterRequest, User } from './types'

export function register(request: RegisterRequest): Promise<AuthResponse> {
  return apiRequest('/auth/register', { method: 'POST', body: request, auth: false })
}

export function login(request: LoginRequest): Promise<AuthResponse> {
  return apiRequest('/auth/login', { method: 'POST', body: request, auth: false })
}

// "Esqueci minha senha": a API responde igual com ou sem conta, e o link vai por e-mail.
export function forgotPassword(email: string): Promise<void> {
  return apiRequest('/auth/forgot-password', { method: 'POST', body: { email }, auth: false })
}

// Troca a senha pelo token do link; todas as sessões da conta caem.
export function resetPassword(token: string, password: string): Promise<void> {
  return apiRequest('/auth/reset-password', { method: 'POST', body: { token, password }, auth: false })
}

export function me(signal?: AbortSignal): Promise<User> {
  return apiRequest('/auth/me', { signal })
}

// Entra com o comprovante do botão do Google; cria a conta se ela não existir.
export function googleSignIn(credential: string): Promise<AuthResponse> {
  return apiRequest('/auth/google', { method: 'POST', body: { credential }, auth: false })
}

export function linkGoogle(credential: string): Promise<User> {
  return apiRequest('/auth/google/link', { method: 'POST', body: { credential } })
}

export function unlinkGoogle(): Promise<User> {
  return apiRequest('/auth/google/unlink', { method: 'POST' })
}

// Confirmação para excluir a conta: a senha atual ou, em conta sem senha, um comprovante novo do Google.
export interface DeleteAccountConfirmation {
  password?: string
  googleCredential?: string
}

// Exclui a conta e todos os dados, de forma irreversível.
export function deleteAccount(confirmation: DeleteAccountConfirmation): Promise<void> {
  return apiRequest('/auth/delete-account', { method: 'POST', body: confirmation })
}

// "Sair de todos os dispositivos" (S.5): a API invalida todos os tokens do usuário, inclusive este.
export function logoutAll(): Promise<void> {
  return apiRequest('/auth/logout-all', { method: 'POST' })
}
