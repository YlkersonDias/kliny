import ptAuth from '../locales/pt-BR/auth.json'
import ptCategories from '../locales/pt-BR/categories.json'
import ptCommon from '../locales/pt-BR/common.json'
import ptDashboard from '../locales/pt-BR/dashboard.json'
import ptErrors from '../locales/pt-BR/errors.json'
import ptLayout from '../locales/pt-BR/layout.json'
import ptReports from '../locales/pt-BR/reports.json'
import ptSettings from '../locales/pt-BR/settings.json'
import ptTransactions from '../locales/pt-BR/transactions.json'
import ptVaults from '../locales/pt-BR/vaults.json'
import enAuth from '../locales/en-US/auth.json'
import enCategories from '../locales/en-US/categories.json'
import enCommon from '../locales/en-US/common.json'
import enDashboard from '../locales/en-US/dashboard.json'
import enErrors from '../locales/en-US/errors.json'
import enLayout from '../locales/en-US/layout.json'
import enReports from '../locales/en-US/reports.json'
import enSettings from '../locales/en-US/settings.json'
import enTransactions from '../locales/en-US/transactions.json'
import enVaults from '../locales/en-US/vaults.json'

// Um arquivo por área da interface. O português é a referência dos tipos das chaves (i18next.d.ts).
// Plurais: o português trata 0 como singular ("0 cofre"), então toda chave com contagem tem
// também a forma _zero, igual à do plural ("0 cofres"). O inglês repete as mesmas chaves.
export const defaultNS = 'common'

const ptBR = {
  common: ptCommon, errors: ptErrors, auth: ptAuth, layout: ptLayout, settings: ptSettings,
  dashboard: ptDashboard, transactions: ptTransactions, categories: ptCategories, vaults: ptVaults, reports: ptReports,
}

// satisfies: chave do português que falta no inglês não compila. A chave a mais e as variáveis
// de cada texto são conferidas pelo teste resources.test.ts.
const enUS = {
  common: enCommon, errors: enErrors, auth: enAuth, layout: enLayout, settings: enSettings,
  dashboard: enDashboard, transactions: enTransactions, categories: enCategories, vaults: enVaults, reports: enReports,
} satisfies typeof ptBR

export const resources = {
  'pt-BR': ptBR,
  'en-US': enUS,
} as const
