import { createContext } from 'react'
import type { DeleteAccountConfirmation } from '../api/auth'
import type { LoginRequest, User } from '../api/types'

export interface AuthContextValue {
  user: User | null
  // true enquanto a sessão guardada é conferida com /api/auth/me ao abrir o app.
  isValidating: boolean
  notice: string | null
  signIn: (request: LoginRequest) => Promise<void>
  completeSignUp: (token: string, password: string) => Promise<void>
  signInWithGoogle: (credential: string) => Promise<void>
  updateUser: (user: User) => void
  signOut: () => void
  signOutEverywhere: () => Promise<void>
  deleteAccount: (confirmation: DeleteAccountConfirmation) => Promise<void>
}

export const AuthContext = createContext<AuthContextValue | null>(null)
