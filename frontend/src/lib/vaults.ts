import i18n from '../i18n'
import { formatDate } from './dates'
import { formatMoney, formatSigned, parseMoneyInput } from './money'

// Centavos inteiros: somar casas decimais acumula erro (0,1 + 0,2).
function toCents(value: number): number {
  return Math.round(value * 100)
}

export function sumMoney(values: number[]): number {
  return values.reduce((total, value) => total + toCents(value), 0) / 100
}

export interface GoalProgress {
  // Arredondado para baixo: 99,6% aparece como 99%, nunca 100% antes da hora.
  percent: number
  reached: boolean
  remaining: number
}

export function goalProgress(balance: number, goal: number): GoalProgress {
  const balanceCents = Math.max(0, toCents(balance))
  const goalCents = toCents(goal)
  const reached = balanceCents >= goalCents
  return {
    percent: reached ? 100 : Math.floor((balanceCents * 100) / goalCents),
    reached,
    remaining: reached ? 0 : (goalCents - balanceCents) / 100,
  }
}

// Vazio, zero ou negativo contam como "sem meta"; texto que não é valor dá 'invalid'.
export function parseGoalInput(text: string): number | null | 'invalid' {
  const withoutCurrency = text.trim().replace(/^R\$\s*/, '')
  if (!withoutCurrency) return null
  const negative = /^[-−]/.test(withoutCurrency)
  const value = parseMoneyInput(negative ? withoutCurrency.replace(/^[-−]\s*/, '') : withoutCurrency)
  if (value === null) return 'invalid'
  return negative || value === 0 ? null : value
}

export function goalReachedNotice(goal: number | null, balance: number): string | undefined {
  if (goal === null || goal <= 0 || balance <= 0) return undefined
  if (toCents(balance) < toCents(goal)) return undefined
  return i18n.t('vaults:form.goalReachedNotice', { balance: formatMoney(balance) })
}

export function formatAccountBalance(value: number): string {
  return value < 0 ? formatSigned(value) : formatMoney(value)
}

// A mesma mensagem da API.
export function depositShortfallMessage(available: number, date: string): string {
  const message = i18n.t('vaults:operation.accountShortfall', { date: formatDate(date), balance: formatAccountBalance(available) })
  return available <= 0 ? `${message} ${i18n.t('vaults:operation.addIncomeFirst')}` : message
}

export function exceedsAccountBalance(amount: number, available: number): boolean {
  return toCents(amount) > toCents(available)
}

// A API tolera um dia por causa do fuso; aqui o limite é exato, pela data local.
export function vaultOperationDateError(date: string, today: string): string | undefined {
  return date > today ? i18n.t('vaults:operation.futureDate') : undefined
}

// Ponto de vista do cofre: o depósito, negativo na conta, aparece positivo.
export function vaultAmount(accountAmount: number): number {
  return accountAmount === 0 ? 0 : -accountAmount
}
