import { Fragment, useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import * as authApi from '../api/auth'
import i18n from '../i18n'
import { setUnauthorizedHandler } from '../api/client'
import type { AuthResponse, LoginRequest, User } from '../api/types'
import { disableGoogleAutoSelect } from '../lib/googleIdentity'
import { clearSimulatorForm } from '../lib/simulatorStore'
import { sessionChange } from '../lib/sessionSync'
import { AuthContext, type AuthContextValue } from './AuthContext'
import {
  SESSION_STORAGE_KEY, adoptSession, clearSession, getCurrentSession, loadSession, parseSession, saveSession, type Session,
} from './session'

// setTimeout aceita no máximo ~24,8 dias; acima disso dispara na hora.
const MAX_TIMEOUT = 2_147_483_647

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient()
  const [session, setSession] = useState<Session | null>(loadSession)
  const [isValidating, setIsValidating] = useState(() => session !== null)
  const [notice, setNotice] = useState<string | null>(null)
  // Muda quando outra aba troca de conta: a tela é remontada sem nada da conta anterior.
  const [screenKey, setScreenKey] = useState(0)

  const endSession = useCallback((message: string | null) => {
    clearSession()
    setSession(null)
    setNotice(message)
    disableGoogleAutoSelect()
    // O próximo usuário do navegador não pode ver os dados do anterior.
    queryClient.clear()
    clearSimulatorForm()
  }, [queryClient])

  const expire = useCallback(() => endSession(i18n.t('errors:sessionExpired')), [endSession])

  // Antes da validação abaixo, para o 401 do /me já encerrar a sessão.
  useEffect(() => {
    setUnauthorizedHandler(expire)
    return () => setUnauthorizedHandler(null)
  }, [expire])

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
      // Sem conexão, mantém a sessão: as próximas chamadas mostram o erro.
      .catch(() => {})
      .finally(() => {
        if (!controller.signal.aborted) setIsValidating(false)
      })
    return () => controller.abort()
  }, [isValidating])

  useEffect(() => {
    if (session === null) return
    const delay = Math.min(Math.max(Date.parse(session.expiresAt) - Date.now(), 0), MAX_TIMEOUT)
    const timer = setTimeout(expire, delay)
    return () => clearTimeout(timer)
  }, [session, expire])

  // Sair ou entrar numa aba vale para todas: a tela nunca fica com a conta que saiu.
  useEffect(() => {
    function handleStorage(event: StorageEvent) {
      // key null: o localStorage inteiro foi limpo.
      if (event.key !== SESSION_STORAGE_KEY && event.key !== null) return
      const next = parseSession(event.key === null ? null : event.newValue)
      const change = sessionChange(getCurrentSession(), next)
      if (change === 'signedOut') {
        endSession(i18n.t('auth:signedOutInOtherTab'))
      } else if (next !== null && change !== 'none') {
        if (change !== 'refreshed') queryClient.clear()
        if (change === 'switched') setScreenKey((key) => key + 1)
        adoptSession(next)
        setSession(next)
        setNotice(null)
      }
    }
    window.addEventListener('storage', handleStorage)
    return () => window.removeEventListener('storage', handleStorage)
  }, [endSession, queryClient])

  const startSession = useCallback((response: AuthResponse) => {
    queryClient.clear()
    saveSession(response)
    setSession(response)
    setNotice(null)
  }, [queryClient])

  const signIn = useCallback(async (request: LoginRequest) => {
    startSession(await authApi.login(request))
  }, [startSession])

  const completeSignUp = useCallback(async (token: string, password: string) => {
    startSession(await authApi.completeRegistration(token, password))
  }, [startSession])

  const signInWithGoogle = useCallback(async (credential: string) => {
    startSession(await authApi.googleSignIn(credential))
  }, [startSession])

  const updateUser = useCallback((user: User) => {
    const current = getCurrentSession()
    if (current === null) return
    const updated = { ...current, user }
    saveSession(updated)
    setSession(updated)
  }, [])

  const signOut = useCallback(() => endSession(null), [endSession])

  // A sessão local só termina depois que a API confirma: se falhar, os outros aparelhos continuariam entrando.
  const signOutEverywhere = useCallback(async () => {
    await authApi.logoutAll()
    endSession(i18n.t('auth:signedOutEverywhere'))
  }, [endSession])

  const deleteAccount = useCallback(async (confirmation: authApi.DeleteAccountConfirmation) => {
    await authApi.deleteAccount(confirmation)
    endSession(i18n.t('auth:accountDeleted'))
  }, [endSession])

  const value = useMemo<AuthContextValue>(() => ({
    user: session?.user ?? null,
    isValidating,
    notice,
    signIn,
    completeSignUp,
    signInWithGoogle,
    updateUser,
    signOut,
    signOutEverywhere,
    deleteAccount,
  }), [session, isValidating, notice, signIn, completeSignUp, signInWithGoogle, updateUser, signOut, signOutEverywhere, deleteAccount])

  return (
    <AuthContext value={value}>
      <Fragment key={screenKey}>{children}</Fragment>
    </AuthContext>
  )
}
