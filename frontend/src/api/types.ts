// Espelho dos DTOs da API. Datas e horas chegam como texto ISO.

export interface User {
  id: number
  name: string
  email: string
  createdAt: string
}

export interface AuthResponse {
  token: string
  expiresAt: string
  user: User
}

export interface LoginRequest {
  email: string
  password: string
}

export interface RegisterRequest {
  name: string
  email: string
  password: string
}

export interface PagedResponse<T> {
  items: T[]
  page: number
  pageSize: number
  totalCount: number
}

export interface Category {
  id: number
  name: string
}

export interface CategoryRequest {
  name: string
}

// amount com o sinal do banco: positivo = receita, negativo = gasto.
// Com vaultId, é uma operação de cofre (depósito negativo, retirada positiva).
export interface Transaction {
  id: number
  description: string
  amount: number
  date: string // YYYY-MM-DD
  categoryId: number | null
  categoryName: string | null
  vaultId: number | null
}

export interface TransactionRequest {
  description: string
  amount: number
  date: string
  categoryId: number | null
}

export type TransactionType = 'income' | 'expense' | 'vault'

export interface TransactionQuery {
  from?: string
  to?: string
  categoryId?: number
  // Só receitas e gastos sem categoria. Não combina com categoryId, vaultId nem type=vault.
  uncategorized?: boolean
  vaultId?: number
  type?: TransactionType
  page?: number
  pageSize?: number
}

// balance é calculado pela API (soma das movimentações do cofre com o sinal invertido).
export interface Vault {
  id: number
  name: string
  goal: number | null
  balance: number
  createdAt: string
}

export interface VaultRequest {
  name: string
  goal: number | null
}

// Depósito e retirada: amount sempre positivo; o endpoint define o sinal gravado.
export interface VaultOperationRequest {
  amount: number
  date: string
  description?: string
}

export interface VaultOperationResponse {
  transaction: Transaction
  balance: number
}

// Relatórios: expense e vaultDeposits vêm POSITIVOS (ao contrário do banco) e net = income - expense.
// Exibir como vieram; nunca inverter o expense de novo.
export interface ReportPeriod {
  from: string
  to: string
}

export interface SummaryResponse {
  from: string
  to: string
  // Movimento do período, sem operações de cofre.
  income: number
  expense: number
  net: number
  vaultDeposits: number
  vaultWithdrawals: number
  // Posição no dia `to`, somando tudo desde o primeiro lançamento.
  accountBalance: number
  vaultsBalance: number
}

export type TimelineGrouping = 'day' | 'month'

// period: o dia, ou o primeiro dia do mês. Sem movimento, os valores vêm zerados.
export interface TimelinePoint {
  period: string
  income: number
  expense: number
  net: number
}

// Formato de erro do ASP.NET Core. `errors` só vem nas falhas de validação.
export interface ProblemDetails {
  type?: string
  title?: string
  status?: number
  detail?: string
  errors?: Record<string, string[]>
}
