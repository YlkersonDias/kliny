import { Fragment, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import i18n, { currentLanguage } from '../i18n'
import { LANGUAGE_STORAGE_KEY, parseLanguage, saveLanguage, type Language } from '../lib/language'
import { LanguageContext } from './LanguageContext'

// Trocar o idioma remonta a tela inteira (key), para valores e datas formatados fora do
// useTranslation também mudarem. O cache do TanStack Query fica, porque está fora daqui.
export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState(currentLanguage)
  const pendingFocus = useRef<string | null>(null)

  const apply = useCallback((next: Language) => {
    if (i18n.language !== next) void i18n.changeLanguage(next)
    setLanguageState(next)
  }, [])

  useEffect(() => {
    document.documentElement.lang = language
    // Depois dos efeitos dos filhos (inclusive o foco de troca de página): o foco pedido vence.
    if (pendingFocus.current !== null) {
      document.getElementById(pendingFocus.current)?.focus()
      pendingFocus.current = null
    }
  }, [language])

  useEffect(() => {
    function handleStorage(event: StorageEvent) {
      // key null: o localStorage inteiro foi limpo.
      if (event.key === LANGUAGE_STORAGE_KEY || event.key === null) apply(parseLanguage(event.newValue))
    }
    window.addEventListener('storage', handleStorage)
    return () => window.removeEventListener('storage', handleStorage)
  }, [apply])

  const setLanguage = useCallback((next: Language, focusId?: string) => {
    saveLanguage(next)
    if (next === currentLanguage()) return
    pendingFocus.current = focusId ?? null
    apply(next)
  }, [apply])

  const value = useMemo(() => ({ language, setLanguage }), [language, setLanguage])

  return (
    <LanguageContext.Provider value={value}>
      <Fragment key={language}>{children}</Fragment>
    </LanguageContext.Provider>
  )
}
