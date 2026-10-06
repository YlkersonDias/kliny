import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import * as authApi from '../api/auth'
import i18n from '../i18n'
import { setUnauthorizedHandler } from '../api/client'
import type { AuthResponse, LoginRequest, RegisterRequest } from '../api/types'
import { AuthContext, type AuthContextValue } from './AuthContext'
import { clearSession, getCurrentSession, loadSession, saveSession, type Session } from './session'

// setTimeout aceita no máximo ~24,8 dias; acima disso o temporizador dispara na hora.
const MAX_TIMEOUT = 2_147_483_647

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient()
  const [session, setSession] = useState<Session | null>(loadSession)
  const [isValidating, setIsValidating] = useState(() => session !== null)
  const [notice, setNotice] = useState<string | null>(null)

  const endSession = useCallback((message: string | null) => {
    clearSession()
    setSession(null)
    setNotice(message)
    // O próximo usuário do navegador não pode ver os dados do anterior.
    queryClient.clear()
  }, [queryClient])

  const expire = useCallback(() => endSession(i18n.t('errors:sessionExpired')), [endSession])

  // Registrado antes da validação abaixo, para o 401 do /me já encerrar a sessão.
  useEffect(() => {
    setUnauthorizedHandler(expire)
    return () => setUnauthorizedHandler(null)
  }, [expire])

  // Ao abrir o app, confirma com a API que o token guardado ainda vale.
  useEffect(() => {
    if (!isValidating) return
    const controller = new AbortController()
    authApi.me(controller.signal)
      .then((user) => {
        const current = getCurrentSession()
        if (current === null) return
        const updated = { ...current, user }
        saveSession(updated)
        setSession(updated)
      })
      // 401 já foi tratado pelo handler. Sem conexão, mantém a sessão: as próximas chamadas mostram o erro.
      .catch(() => {})
      .finally(() => {
        if (!controller.signal.aborted) setIsValidating(false)
      })
    return () => controller.abort()
  }, [isValidating])

  // Encerra a sessão quando o token vence.
  useEffect(() => {
    if (session === null) return
    const delay = Math.min(Math.max(Date.parse(session.expiresAt) - Date.now(), 0), MAX_TIMEOUT)
    const timer = setTimeout(expire, delay)
    return () => clearTimeout(timer)
  }, [session, expire])

  const startSession = useCallback((response: AuthResponse) => {
    queryClient.clear()
    saveSession(response)
    setSession(response)
    setNotice(null)
  }, [queryClient])

  const signIn = useCallback(async (request: LoginRequest) => {
    startSession(await authApi.login(request))
  }, [startSession])

  const signUp = useCallback(async (request: RegisterRequest) => {
    startSession(await authApi.register(request))
  }, [startSession])

  const signOut = useCallback(() => endSession(null), [endSession])

  const value = useMemo<AuthContextValue>(() => ({
    user: session?.user ?? null,
    isValidating,
    notice,
    signIn,
    signUp,
    signOut,
  }), [session, isValidating, notice, signIn, signUp, signOut])

  return <AuthContext value={value}>{children}</AuthContext>
}
