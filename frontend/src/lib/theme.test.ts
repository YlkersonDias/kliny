import { describe, expect, it } from 'vitest'
import { parseThemePreference, resolveTheme } from './theme'

describe('parseThemePreference', () => {
  it('aceita claro, escuro e sistema', () => {
    expect(parseThemePreference('light')).toBe('light')
    expect(parseThemePreference('dark')).toBe('dark')
    expect(parseThemePreference('system')).toBe('system')
  })

  it('trata ausente, inválido ou de outro tipo como escuro (o padrão)', () => {
    expect(parseThemePreference(null)).toBe('dark')
    expect(parseThemePreference('Light')).toBe('dark')
    expect(parseThemePreference('"light"')).toBe('dark')
    expect(parseThemePreference(1)).toBe('dark')
  })
})

describe('resolveTheme', () => {
  it('segue o sistema só na opção sistema', () => {
    expect(resolveTheme('system', true)).toBe('dark')
    expect(resolveTheme('system', false)).toBe('light')
  })

  it('a escolha explícita vence o sistema', () => {
    expect(resolveTheme('light', true)).toBe('light')
    expect(resolveTheme('dark', false)).toBe('dark')
  })
})
