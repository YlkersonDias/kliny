import ptAuth from '../locales/pt-BR/auth.json'
import ptCategories from '../locales/pt-BR/categories.json'
import ptCommon from '../locales/pt-BR/common.json'
import ptDashboard from '../locales/pt-BR/dashboard.json'
import ptErrors from '../locales/pt-BR/errors.json'
import ptImports from '../locales/pt-BR/imports.json'
import ptLanding from '../locales/pt-BR/landing.json'
import ptLayout from '../locales/pt-BR/layout.json'
import ptPrivacy from '../locales/pt-BR/privacy.json'
import ptReports from '../locales/pt-BR/reports.json'
import ptSettings from '../locales/pt-BR/settings.json'
import ptSimulator from '../locales/pt-BR/simulator.json'
import ptTransactions from '../locales/pt-BR/transactions.json'
import ptVaults from '../locales/pt-BR/vaults.json'
import enAuth from '../locales/en-US/auth.json'
import enCategories from '../locales/en-US/categories.json'
import enCommon from '../locales/en-US/common.json'
import enDashboard from '../locales/en-US/dashboard.json'
import enErrors from '../locales/en-US/errors.json'
import enImports from '../locales/en-US/imports.json'
import enLanding from '../locales/en-US/landing.json'
import enLayout from '../locales/en-US/layout.json'
import enPrivacy from '../locales/en-US/privacy.json'
import enReports from '../locales/en-US/reports.json'
import enSettings from '../locales/en-US/settings.json'
import enSimulator from '../locales/en-US/simulator.json'
import enTransactions from '../locales/en-US/transactions.json'
import enVaults from '../locales/en-US/vaults.json'

// O português é a referência dos tipos. Ele trata 0 como singular, então toda chave com contagem
// tem também a forma _zero, igual à do plural.
export const defaultNS = 'common'

const ptBR = {
  common: ptCommon, errors: ptErrors, auth: ptAuth, layout: ptLayout, settings: ptSettings,
  dashboard: ptDashboard, transactions: ptTransactions, categories: ptCategories, vaults: ptVaults, reports: ptReports,
  privacy: ptPrivacy, landing: ptLanding, imports: ptImports, simulator: ptSimulator,
}

// satisfies: chave do português que falta no inglês não compila (o resto, o resources.test.ts confere).
const enUS = {
  common: enCommon, errors: enErrors, auth: enAuth, layout: enLayout, settings: enSettings,
  dashboard: enDashboard, transactions: enTransactions, categories: enCategories, vaults: enVaults, reports: enReports,
  privacy: enPrivacy, landing: enLanding, imports: enImports, simulator: enSimulator,
} satisfies typeof ptBR

export const resources = {
  'pt-BR': ptBR,
  'en-US': enUS,
} as const
