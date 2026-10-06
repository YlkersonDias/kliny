import { afterEach, describe, expect, it, vi } from 'vitest'
import { LANGUAGE_STORAGE_KEY, parseLanguage, readLanguage, saveLanguage } from './language'

describe('parseLanguage', () => {
  it('aceita português e inglês', () => {
    expect(parseLanguage('pt-BR')).toBe('pt-BR')
    expect(parseLanguage('en-US')).toBe('en-US')
  })

  it('trata ausente, inválido ou de outro tipo como português (o padrão)', () => {
    expect(parseLanguage(null)).toBe('pt-BR')
    expect(parseLanguage('en')).toBe('pt-BR')
    expect(parseLanguage('en-us')).toBe('pt-BR')
    expect(parseLanguage('fr-FR')).toBe('pt-BR')
    expect(parseLanguage(1)).toBe('pt-BR')
  })
})

describe('readLanguage e saveLanguage', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('guarda e lê a escolha', () => {
    const store = new Map<string, string>()
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => void store.set(key, value),
    })
    expect(readLanguage()).toBe('pt-BR')
    saveLanguage('en-US')
    expect(store.get(LANGUAGE_STORAGE_KEY)).toBe('en-US')
    expect(readLanguage()).toBe('en-US')
  })

  it('com o localStorage bloqueado, vale o português e salvar não lança erro', () => {
    const blocked = () => { throw new Error('SecurityError') }
    vi.stubGlobal('localStorage', { getItem: blocked, setItem: blocked })
    expect(readLanguage()).toBe('pt-BR')
    expect(() => saveLanguage('en-US')).not.toThrow()
  })
})
