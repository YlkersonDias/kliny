import { describe, expect, it } from 'vitest'
import i18n from './index'
import { resources } from './resources'

// O português trata 0 como singular: sem a forma _zero, "0 cofres" sairia "0 cofre".

describe('plural com contagem 0', () => {
  it('o pt-BR põe 0 na categoria one, não na other', () => {
    expect(new Intl.PluralRules('pt-BR').select(0)).toBe('one')
  })

  it('usa a forma _zero nas chaves reais', () => {
    expect(i18n.t('vaults:count', { count: 0 })).toBe('0 cofres')
    expect(i18n.t('transactions:count', { count: 0 })).toBe('0 movimentações')
    expect(i18n.t('vaults:count', { count: 1 })).toBe('1 cofre')
  })
})

function oneKeys(node: unknown, path: string): string[] {
  if (typeof node !== 'object' || node === null) return []
  return Object.entries(node).flatMap(([key, value]) => {
    const full = path.endsWith(':') ? `${path}${key}` : `${path}.${key}`
    if (key.endsWith('_one')) return [full]
    return oneKeys(value, full)
  })
}

function has(namespaces: Record<string, unknown>, path: string): boolean {
  const [ns, rest] = path.split(':')
  let node: unknown = namespaces[ns]
  for (const part of rest.split('.')) {
    if (typeof node !== 'object' || node === null || !(part in node)) return false
    node = (node as Record<string, unknown>)[part]
  }
  return typeof node === 'string'
}

describe('chaves de plural', () => {
  const namespaces = resources['pt-BR'] as Record<string, unknown>
  const keys = Object.entries(namespaces).flatMap(([ns, content]) => oneKeys(content, `${ns}:`))

  it('existem chaves de plural para conferir', () => {
    expect(keys.length).toBeGreaterThan(0)
  })

  it('toda chave _one tem a forma _zero correspondente', () => {
    const missing = keys.filter((key) => !has(namespaces, key.replace(/_one$/, '_zero')))
    expect(missing).toEqual([])
  })
})
