// Tema da interface. A preferência fica no localStorage, por navegador (não na conta).
// O script do index.html repete esta regra para aplicar o tema antes do React: mudou aqui,
// mudar lá também (mesma chave e mesmos valores).

export type ThemePreference = 'light' | 'dark' | 'system'
export type Theme = 'light' | 'dark'

export const THEME_STORAGE_KEY = 'ui.theme'
export const DARK_QUERY = '(prefers-color-scheme: dark)'
// Quem nunca escolheu abre no escuro, qualquer que seja o tema do sistema operacional.
export const DEFAULT_THEME_PREFERENCE: ThemePreference = 'dark'

// Valor ausente, inválido ou de outra versão vale o padrão (escuro).
export function parseThemePreference(value: unknown): ThemePreference {
  return value === 'light' || value === 'dark' || value === 'system' ? value : DEFAULT_THEME_PREFERENCE
}

export function resolveTheme(preference: ThemePreference, systemPrefersDark: boolean): Theme {
  if (preference === 'system') return systemPrefersDark ? 'dark' : 'light'
  return preference
}

// O localStorage pode estar bloqueado (o acesso lança erro): aí vale o padrão, e a escolha
// feita na tela dura só até recarregar.
export function readThemePreference(): ThemePreference {
  try {
    return parseThemePreference(localStorage.getItem(THEME_STORAGE_KEY))
  } catch {
    return DEFAULT_THEME_PREFERENCE
  }
}

// Guarda as três opções, inclusive "system": ausente significa o padrão (escuro), não o sistema.
export function saveThemePreference(preference: ThemePreference): void {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, preference)
  } catch {
    // Sem localStorage, a escolha vale só nesta aba.
  }
}
