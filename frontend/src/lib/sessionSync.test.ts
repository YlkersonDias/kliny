import { describe, expect, it } from 'vitest'
import { parseSession, type Session } from '../auth/session'
import { sessionChange } from './sessionSync'

const FUTURE = '2999-01-01T00:00:00Z'
const ANA: Session = { token: 'token-ana', expiresAt: FUTURE, user: { id: 1, name: 'Ana', email: 'ana@kliny.test', createdAt: '2026-10-01T00:00:00Z' } }
const BIA: Session = { token: 'token-bia', expiresAt: FUTURE, user: { id: 2, name: 'Bia', email: 'bia@kliny.test', createdAt: '2026-10-01T00:00:00Z' } }

describe('sessionChange', () => {
  it('sair em outra aba encerra esta', () => {
    expect(sessionChange(ANA, null)).toBe('signedOut')
  })

  it('sem sessão dos dois lados, nada muda', () => {
    expect(sessionChange(null, null)).toBe('none')
  })

  it('entrar em outra aba entra nesta', () => {
    expect(sessionChange(null, ANA)).toBe('signedIn')
  })

  it('outra conta troca a conta desta aba', () => {
    expect(sessionChange(ANA, BIA)).toBe('switched')
  })

  it('mesma conta com token novo ou nome novo só renova', () => {
    expect(sessionChange(ANA, { ...ANA, token: 'outro-token' })).toBe('refreshed')
    expect(sessionChange(ANA, { ...ANA, user: { ...ANA.user, name: 'Ana Maria' } })).toBe('refreshed')
  })

  it('a mesma sessão gravada de novo não muda nada', () => {
    expect(sessionChange(ANA, JSON.parse(JSON.stringify(ANA)) as Session)).toBe('none')
  })
})

describe('parseSession', () => {
  it('lê a sessão gravada', () => {
    expect(parseSession(JSON.stringify(ANA))).toEqual(ANA)
  })

  it('chave apagada, JSON corrompido, formato errado ou token vencido contam como sem sessão', () => {
    expect(parseSession(null)).toBeNull()
    expect(parseSession('{quebrado')).toBeNull()
    expect(parseSession(JSON.stringify({ token: 'x' }))).toBeNull()
    expect(parseSession(JSON.stringify({ ...ANA, expiresAt: '2000-01-01T00:00:00Z' }))).toBeNull()
  })

  it('um vencido em outra aba encerra esta', () => {
    expect(sessionChange(ANA, parseSession(JSON.stringify({ ...ANA, expiresAt: '2000-01-01T00:00:00Z' })))).toBe('signedOut')
  })
})
