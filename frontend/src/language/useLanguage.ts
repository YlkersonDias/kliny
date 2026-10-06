import { useContext } from 'react'
import { LanguageContext, type LanguageContextValue } from './LanguageContext'

export function useLanguage(): LanguageContextValue {
  const context = useContext(LanguageContext)
  if (context === null) throw new Error('useLanguage deve ser usado dentro de LanguageProvider.')
  return context
}
