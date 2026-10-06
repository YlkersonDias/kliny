import auth from '../locales/pt-BR/auth.json'
import categories from '../locales/pt-BR/categories.json'
import common from '../locales/pt-BR/common.json'
import dashboard from '../locales/pt-BR/dashboard.json'
import errors from '../locales/pt-BR/errors.json'
import layout from '../locales/pt-BR/layout.json'
import reports from '../locales/pt-BR/reports.json'
import settings from '../locales/pt-BR/settings.json'
import transactions from '../locales/pt-BR/transactions.json'
import vaults from '../locales/pt-BR/vaults.json'

// Um arquivo por área da interface. O português é a referência dos tipos das chaves (i18next.d.ts).
// Plurais: o português trata 0 como singular ("0 cofre"), então toda chave com contagem tem
// também a forma _zero, igual à do plural ("0 cofres").
export const defaultNS = 'common'

export const resources = {
  'pt-BR': { common, errors, auth, layout, settings, dashboard, transactions, categories, vaults, reports },
} as const
