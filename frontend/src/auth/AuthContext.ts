import { createContext } from 'react'
import type { DeleteAccountConfirmation } from '../api/auth'
import type { LoginRequest, User } from '../api/types'

export interface AuthContextValue {
  user: User | null
  // true enquanto a sessão guardada é conferida com /api/auth/me ao abrir o app.
  isValidating: boolean
  // Aviso para a tela de login, como "Sua sessão expirou".
  notice: string | null
  signIn: (request: LoginRequest) => Promise<void>
  // Fim do cadastro pelo link do e-mail: cria a conta e entra nela.
  completeSignUp: (token: string, password: string) => Promise<void>
  // Entra (ou cria a conta) com o comprovante do botão do Google.
  signInWithGoogle: (credential: string) => Promise<void>
  // Atualiza os dados do usuário na sessão (depois de vincular ou desvincular o Google).
  updateUser: (user: User) => void
  signOut: () => void
  // Invalida os tokens de todos os aparelhos na API (S.5) e encerra a sessão local.
  signOutEverywhere: () => Promise<void>
  // Exclui a conta na API (com a senha ou, sem senha, o Google) e encerra a sessão local.
  deleteAccount: (confirmation: DeleteAccountConfirmation) => Promise<void>
}

export const AuthContext = createContext<AuthContextValue | null>(null)
