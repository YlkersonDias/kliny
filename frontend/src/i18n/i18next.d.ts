import 'i18next'
import type { defaultNS, resources } from './resources'

// t('chave') com uma chave que não existe no português não compila.
declare module 'i18next' {
  interface CustomTypeOptions {
    defaultNS: typeof defaultNS
    resources: (typeof resources)['pt-BR']
  }
}
