import type { Session } from '../auth/session'

export type SessionChange = 'none' | 'signedIn' | 'signedOut' | 'switched' | 'refreshed'

// O que a sessão gravada por outra aba muda nesta: o navegador tem uma sessão só.
export function sessionChange(current: Session | null, next: Session | null): SessionChange {
  if (next === null) return current === null ? 'none' : 'signedOut'
  if (current === null) return 'signedIn'
  if (current.user.id !== next.user.id) return 'switched'
  return JSON.stringify(current) === JSON.stringify(next) ? 'none' : 'refreshed'
}
