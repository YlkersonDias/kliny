import { createContext } from 'react'
import type { Language } from '../lib/language'

export interface LanguageContextValue {
  language: Language
  // A tela é remontada na troca, e o foco se perderia.
  setLanguage: (language: Language, focusId?: string) => void
}

export const LanguageContext = createContext<LanguageContextValue | null>(null)
