// Idioma da interface. A escolha fica no localStorage, por navegador (não na conta), como o tema.
// O script do index.html repete esta regra para aplicar o <html lang> antes do React: mudou aqui,
// mudar lá também (mesma chave e mesmos valores).

export type Language = 'pt-BR' | 'en-US'

export const LANGUAGES: Language[] = ['pt-BR', 'en-US']
export const LANGUAGE_STORAGE_KEY = 'ui.language'
// Português é sempre o padrão, qualquer que seja o idioma do navegador.
export const DEFAULT_LANGUAGE: Language = 'pt-BR'

// Nome de cada idioma escrito nele mesmo (com lang no elemento), igual nas duas interfaces:
// quem não lê o idioma atual ainda reconhece o seu. Por isso fica fora do i18n.
export const LANGUAGE_NAMES: Record<Language, string> = {
  'pt-BR': 'Português (Brasil)',
  'en-US': 'English (US)',
}
export const LANGUAGE_SHORT_NAMES: Record<Language, string> = {
  'pt-BR': 'Português',
  'en-US': 'English',
}

// Valor ausente, inválido ou de outra versão vale o padrão (português).
export function parseLanguage(value: unknown): Language {
  return value === 'pt-BR' || value === 'en-US' ? value : DEFAULT_LANGUAGE
}

// O localStorage pode estar bloqueado (o acesso lança erro): aí vale o padrão, e a escolha
// feita na tela dura só até recarregar.
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
    // Sem localStorage, a escolha vale só nesta aba.
  }
}
