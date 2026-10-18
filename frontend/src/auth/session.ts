import type { User } from '../api/types'

export interface Session {
  token: string
  expiresAt: string
  user: User
}

const STORAGE_KEY = 'auth.session'

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
export function loadSession(): Session | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    const parsed: unknown = raw === null ? null : JSON.parse(raw)
    current = isSession(parsed) && !isExpired(parsed) ? parsed : null
  } catch {
    current = null
  }
  if (current === null) clearSession()
  return current
}

export function saveSession(session: Session): void {
  current = session
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(session))
  } catch {
    // Sem localStorage (bloqueado ou cheio): só não lembra.
  }
}

export function clearSession(): void {
  current = null
  try {
    localStorage.removeItem(STORAGE_KEY)
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
