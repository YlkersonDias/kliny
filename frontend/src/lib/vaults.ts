import { formatDate } from './dates'
import { formatMoney, formatSigned, parseMoneyInput } from './money'

// Cálculos dos cofres que a API não devolve prontos.

// Centavos inteiros: somar números com casas decimais acumula erro (0,1 + 0,2).
function toCents(value: number): number {
  return Math.round(value * 100)
}

export function sumMoney(values: number[]): number {
  return values.reduce((total, value) => total + toCents(value), 0) / 100
}

export interface GoalProgress {
  // De 0 a 100, arredondado para baixo: 99,6% aparece como 99%, nunca 100% antes da hora.
  percent: number
  reached: boolean
  // Quanto falta (zero quando atingida).
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

// Meta digitada no formulário do cofre (decisão do usuário): vazio, zero ou negativo contam como
// "sem meta" (null), igual a apagar o campo; texto que não é valor dá 'invalid'.
export function parseGoalInput(text: string): number | null | 'invalid' {
  const withoutCurrency = text.trim().replace(/^R\$\s*/, '')
  if (!withoutCurrency) return null
  // Hífen ou o sinal de menos tipográfico, antes ou depois do "R$".
  const negative = /^[-−]/.test(withoutCurrency)
  const value = parseMoneyInput(negative ? withoutCurrency.replace(/^[-−]\s*/, '') : withoutCurrency)
  if (value === null) return 'invalid'
  return negative || value === 0 ? null : value
}

// Aviso (não bloqueia) ao editar um cofre com uma meta que o saldo já atinge: ele vai aparecer
// como "Meta atingida". Sem meta válida ou sem saldo, não há aviso.
export function goalReachedNotice(goal: number | null, balance: number): string | undefined {
  if (goal === null || goal <= 0 || balance <= 0) return undefined
  if (toCents(balance) < toCents(goal)) return undefined
  return `O cofre já tem ${formatMoney(balance)} guardados, o que já atinge esta meta. Ele vai aparecer como “Meta atingida”.`
}

// Saldo da conta com o "−" tipográfico quando negativo (a conta pode estar no vermelho).
export function formatAccountBalance(value: number): string {
  return value < 0 ? formatSigned(value) : formatMoney(value)
}

// Depósito acima do saldo da conta na data do depósito (mesma mensagem da API). Sem saldo,
// orienta a lançar uma receita, para quem criou um cofre antes de lançar qualquer coisa.
export function depositShortfallMessage(available: number, date: string): string {
  const message = `Saldo insuficiente na conta. Disponível em ${formatDate(date)}: ${formatAccountBalance(available)}.`
  return available <= 0 ? `${message} Lance uma receita antes de depositar.` : message
}

// Depósito cabe no saldo da conta? Em centavos, para 0,1 + 0,2 não dar diferença.
export function exceedsAccountBalance(amount: number, available: number): boolean {
  return toCents(amount) > toCents(available)
}

// Depósito e retirada só com data de hoje ou passada (a API também recusa data futura,
// com uma folga de fuso; aqui o limite é exato, pela data local). Datas como texto YYYY-MM-DD.
export function vaultOperationDateError(date: string, today: string): string | undefined {
  return date > today ? 'Operações de cofre não podem ter data futura.' : undefined
}

// Extrato do ponto de vista do cofre. No banco o depósito é negativo (sai da conta);
// aqui ele aparece positivo (entra no cofre), e a retirada negativa.
export function vaultAmount(accountAmount: number): number {
  return accountAmount === 0 ? 0 : -accountAmount
}
