import { createContext } from 'react'
import type { Language } from '../lib/language'

export interface LanguageContextValue {
  language: Language
  // focusId: elemento que recebe o foco depois da troca (a tela é remontada e o foco se perderia).
  setLanguage: (language: Language, focusId?: string) => void
}

export const LanguageContext = createContext<LanguageContextValue | null>(null)
