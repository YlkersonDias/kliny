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

// Extrato do ponto de vista do cofre. No banco o depósito é negativo (sai da conta);
// aqui ele aparece positivo (entra no cofre), e a retirada negativa.
export function vaultAmount(accountAmount: number): number {
  return accountAmount === 0 ? 0 : -accountAmount
}
