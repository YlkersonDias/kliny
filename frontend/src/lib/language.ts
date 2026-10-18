// O script do index.html repete esta regra para aplicar o <html lang> antes do React: mudou aqui, mudar lá.

export type Language = 'pt-BR' | 'en-US'

export const LANGUAGES: Language[] = ['pt-BR', 'en-US']
export const LANGUAGE_STORAGE_KEY = 'ui.language'
export const DEFAULT_LANGUAGE: Language = 'pt-BR'

// Cada idioma escrito nele mesmo, para quem não lê o idioma atual reconhecer o seu.
export const LANGUAGE_NAMES: Record<Language, string> = {
  'pt-BR': 'Português (Brasil)',
  'en-US': 'English (US)',
}
export const LANGUAGE_SHORT_NAMES: Record<Language, string> = {
  'pt-BR': 'Português',
  'en-US': 'English',
}

export function parseLanguage(value: unknown): Language {
  return value === 'pt-BR' || value === 'en-US' ? value : DEFAULT_LANGUAGE
}

// O localStorage pode estar bloqueado: aí vale o padrão.
export function readLanguage(): Language {
  try {
    return parseLanguage(localStorage.getItem(LANGUAGE_STORAGE_KEY))
  } catch {
    return DEFAULT_LANGUAGE
  }
}

export function saveLanguage(language: Language): void {
  try {
    localStorage.setItem(LANGUAGE_STORAGE_KEY, language)
  } catch {
    // Sem localStorage (bloqueado ou cheio): só não lembra.
  }
}
