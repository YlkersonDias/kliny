import { createContext } from 'react'
import type { LoginRequest, RegisterRequest, User } from '../api/types'

export interface AuthContextValue {
  user: User | null
  // true enquanto a sessão guardada é conferida com /api/auth/me ao abrir o app.
  isValidating: boolean
  // Aviso para a tela de login, como "Sua sessão expirou".
  notice: string | null
  signIn: (request: LoginRequest) => Promise<void>
  signUp: (request: RegisterRequest) => Promise<void>
  signOut: () => void
  // Invalida os tokens de todos os aparelhos na API (S.5) e encerra a sessão local.
  signOutEverywhere: () => Promise<void>
}

export const AuthContext = createContext<AuthContextValue | null>(null)
