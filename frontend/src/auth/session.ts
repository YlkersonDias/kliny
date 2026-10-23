import type { User } from '../api/types'

export interface Session {
  token: string
  expiresAt: string
  user: User
}

export const SESSION_STORAGE_KEY = 'auth.session'

// Cópia em memória: continua valendo se o navegador bloquear o localStorage.
let current: Session | null = null

export function isExpired(session: Session): boolean {
  return Date.parse(session.expiresAt) <= Date.now()
}

function isSession(value: unknown): value is Session {
  if (typeof value !== 'object' || value === null) return false
  const { token, expiresAt, user } = value as Record<string, unknown>
  if (typeof token !== 'string' || token === '') return false
  if (typeof expiresAt !== 'string' || Number.isNaN(Date.parse(expiresAt))) return false
  if (typeof user !== 'object' || user === null) return false
  const { id, name, email } = user as Record<string, unknown>
  return typeof id === 'number' && typeof name === 'string' && typeof email === 'string'
}

// JSON corrompido, formato inesperado ou token vencido são descartados.
export function parseSession(raw: string | null): Session | null {
  if (raw === null) return null
  try {
    const parsed: unknown = JSON.parse(raw)
    return isSession(parsed) && !isExpired(parsed) ? parsed : null
  } catch {
    return null
  }
}

export function loadSession(): Session | null {
  try {
    current = parseSession(localStorage.getItem(SESSION_STORAGE_KEY))
  } catch {
    current = null
  }
  if (current === null) clearSession()
  return current
}

// Sessão que outra aba gravou: o localStorage já está certo, só falta a cópia em memória.
export function adoptSession(session: Session): void {
  current = session
}

export function saveSession(session: Session): void {
  current = session
  try {
    localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session))
  } catch {
    // Sem localStorage (bloqueado ou cheio): só não lembra.
  }
}

export function clearSession(): void {
  current = null
  try {
    localStorage.removeItem(SESSION_STORAGE_KEY)
  } catch {
    // Sem localStorage (bloqueado ou cheio): só não lembra.
  }
}

export function getSessionToken(): string | null {
  return current?.token ?? null
}

export function getCurrentSession(): Session | null {
  return current
}
