// Tema da interface. A preferência fica no localStorage, por navegador (não na conta).
// O script do index.html repete esta regra para aplicar o tema antes do React: mudou aqui,
// mudar lá também (mesma chave e mesmos valores).

export type ThemePreference = 'light' | 'dark' | 'system'
export type Theme = 'light' | 'dark'

export const THEME_STORAGE_KEY = 'ui.theme'
export const DARK_QUERY = '(prefers-color-scheme: dark)'

// Valor ausente, inválido ou de outra versão vale "system".
export function parseThemePreference(value: unknown): ThemePreference {
  return value === 'light' || value === 'dark' ? value : 'system'
}

export function resolveTheme(preference: ThemePreference, systemPrefersDark: boolean): Theme {
  if (preference === 'system') return systemPrefersDark ? 'dark' : 'light'
  return preference
}

// O localStorage pode estar bloqueado (o acesso lança erro): aí vale "system", e a escolha
// feita na tela dura só até recarregar.
export function readThemePreference(): ThemePreference {
  try {
    return parseThemePreference(localStorage.getItem(THEME_STORAGE_KEY))
  } catch {
    return 'system'
  }
}

export function saveThemePreference(preference: ThemePreference): void {
  try {
    // "system" é o padrão: em vez de guardar, apaga.
    if (preference === 'system') localStorage.removeItem(THEME_STORAGE_KEY)
    else localStorage.setItem(THEME_STORAGE_KEY, preference)
  } catch {
    // Sem localStorage, a escolha vale só nesta aba.
  }
}
