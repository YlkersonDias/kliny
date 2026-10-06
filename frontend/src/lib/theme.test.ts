import { describe, expect, it } from 'vitest'
import { parseThemePreference, resolveTheme } from './theme'

describe('parseThemePreference', () => {
  it('aceita claro e escuro', () => {
    expect(parseThemePreference('light')).toBe('light')
    expect(parseThemePreference('dark')).toBe('dark')
  })

  it('trata ausente, inválido ou de outro tipo como sistema', () => {
    expect(parseThemePreference(null)).toBe('system')
    expect(parseThemePreference('system')).toBe('system')
    expect(parseThemePreference('Dark')).toBe('system')
    expect(parseThemePreference('"dark"')).toBe('system')
    expect(parseThemePreference(1)).toBe('system')
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
