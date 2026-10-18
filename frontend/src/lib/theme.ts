// O script do index.html repete esta regra para aplicar o tema antes do React: mudou aqui, mudar lá.

import { THEME_COLORS } from './themeColors'

export type ThemePreference = 'light' | 'dark' | 'system'
export type Theme = 'light' | 'dark'

export const THEME_STORAGE_KEY = 'ui.theme'
export const DARK_QUERY = '(prefers-color-scheme: dark)'
export const DEFAULT_THEME_PREFERENCE: ThemePreference = 'dark'

export function applyThemeColor(theme: Theme): void {
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', THEME_COLORS[theme])
}

export function parseThemePreference(value: unknown): ThemePreference {
  return value === 'light' || value === 'dark' || value === 'system' ? value : DEFAULT_THEME_PREFERENCE
}

export function resolveTheme(preference: ThemePreference, systemPrefersDark: boolean): Theme {
  if (preference === 'system') return systemPrefersDark ? 'dark' : 'light'
  return preference
}

// O localStorage pode estar bloqueado: aí vale o padrão.
export function readThemePreference(): ThemePreference {
  try {
    return parseThemePreference(localStorage.getItem(THEME_STORAGE_KEY))
  } catch {
    return DEFAULT_THEME_PREFERENCE
  }
}

// Guarda também "system": ausente significa o padrão (escuro), não o sistema.
export function saveThemePreference(preference: ThemePreference): void {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, preference)
  } catch {
    // Sem localStorage (bloqueado ou cheio): só não lembra.
  }
}
