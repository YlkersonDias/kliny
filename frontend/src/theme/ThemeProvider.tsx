import { useCallback, useEffect, useMemo, useState, useSyncExternalStore, type ReactNode } from 'react'
import {
  applyThemeColor,
  DARK_QUERY,
  THEME_STORAGE_KEY,
  parseThemePreference,
  readThemePreference,
  resolveTheme,
  saveThemePreference,
  type ThemePreference,
} from '../lib/theme'
import { ThemeContext } from './ThemeContext'

function subscribeSystemTheme(onChange: () => void) {
  const query = window.matchMedia(DARK_QUERY)
  query.addEventListener('change', onChange)
  return () => query.removeEventListener('change', onChange)
}

function systemPrefersDark() {
  return window.matchMedia(DARK_QUERY).matches
}

// O index.html já aplicou o tema antes do React; aqui ele acompanha a escolha na tela, a mudança
// do sistema operacional (em "Sistema") e a escolha feita em outra aba.
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [preference, setPreferenceState] = useState(readThemePreference)
  const prefersDark = useSyncExternalStore(subscribeSystemTheme, systemPrefersDark)
  const theme = resolveTheme(preference, prefersDark)

  useEffect(() => {
    const root = document.documentElement
    applyThemeColor(theme)
    if (root.dataset.theme === theme) return
    // Sem transição durante a troca: botões e links com transition-colors mudariam em 150 ms
    // enquanto o fundo muda na hora, e a tela passaria por combinações sem contraste.
    root.dataset.themeSwitching = ''
    root.dataset.theme = theme
    void root.offsetHeight // aplica as cores novas antes de religar as transições
    const frame = requestAnimationFrame(() => delete root.dataset.themeSwitching)
    return () => {
      cancelAnimationFrame(frame)
      delete root.dataset.themeSwitching
    }
  }, [theme])

  useEffect(() => {
    function handleStorage(event: StorageEvent) {
      // key null: o localStorage inteiro foi limpo.
      if (event.key === THEME_STORAGE_KEY || event.key === null) {
        setPreferenceState(parseThemePreference(event.newValue))
      }
    }
    window.addEventListener('storage', handleStorage)
    return () => window.removeEventListener('storage', handleStorage)
  }, [])

  const setPreference = useCallback((next: ThemePreference) => {
    saveThemePreference(next)
    setPreferenceState(next)
  }, [])

  const value = useMemo(() => ({ preference, theme, setPreference }), [preference, theme, setPreference])

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}
