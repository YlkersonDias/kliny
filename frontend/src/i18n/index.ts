import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import { APP_NAME } from '../config/app'
import { parseLanguage, readLanguage, type Language } from '../lib/language'
import { defaultNS, resources } from './resources'

// Os textos vão no bundle principal e a inicialização é síncrona: a primeira tela não espera nada.
void i18n.use(initReactI18next).init({
  lng: readLanguage(),
  fallbackLng: 'pt-BR',
  supportedLngs: ['pt-BR', 'en-US'],
  resources,
  defaultNS,
  ns: Object.keys(resources['pt-BR']),
  initAsync: false,
  interpolation: {
    // O React já escapa o texto.
    escapeValue: false,
    defaultVariables: { appName: APP_NAME },
  },
})

// Para os formatos de valor e data e o Accept-Language da API.
export function currentLanguage(): Language {
  return parseLanguage(i18n.language)
}

export default i18n
