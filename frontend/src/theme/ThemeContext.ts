import { createContext } from 'react'
import type { Theme, ThemePreference } from '../lib/theme'

export interface ThemeContextValue {
  // O que o usuário escolheu (Claro, Escuro ou Sistema).
  preference: ThemePreference
  // O tema aplicado agora; em "Sistema", depende do sistema operacional.
  theme: Theme
  setPreference: (preference: ThemePreference) => void
}

export const ThemeContext = createContext<ThemeContextValue | null>(null)
