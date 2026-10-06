import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import { APP_NAME } from '../config/app'
import { defaultNS, resources } from './resources'

// Textos da interface (etapa 7). Só português por enquanto; o inglês entra na 7.3.
// Os textos vão no bundle principal e a inicialização é síncrona: a primeira tela não espera nada.
// Componentes usam o hook useTranslation; lib/ e api/ usam esta instância (i18n.t) direto.
void i18n.use(initReactI18next).init({
  lng: 'pt-BR',
  fallbackLng: 'pt-BR',
  resources,
  defaultNS,
  ns: Object.keys(resources['pt-BR']),
  initAsync: false,
  interpolation: {
    // O React já escapa o texto.
    escapeValue: false,
    // "{{appName}}" em qualquer texto: o nome continua vindo só do APP_NAME.
    defaultVariables: { appName: APP_NAME },
  },
})

export default i18n
