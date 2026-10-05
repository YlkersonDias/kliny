import { formatMoney } from './money'

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

// Aviso (não bloqueia) ao editar um cofre com uma meta que o saldo já atinge: ele vai aparecer
// como "Meta atingida". Sem meta válida ou sem saldo, não há aviso.
export function goalReachedNotice(goal: number | null, balance: number): string | undefined {
  if (goal === null || goal <= 0 || balance <= 0) return undefined
  if (toCents(balance) < toCents(goal)) return undefined
  return `O cofre já tem ${formatMoney(balance)} guardados, o que já atinge esta meta. Ele vai aparecer como “Meta atingida”.`
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
