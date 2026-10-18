import { createContext } from 'react'
import type { Theme, ThemePreference } from '../lib/theme'

export interface ThemeContextValue {
  preference: ThemePreference
  // Em "Sistema", depende do sistema operacional.
  theme: Theme
  setPreference: (preference: ThemePreference) => void
}

export const ThemeContext = createContext<ThemeContextValue | null>(null)
