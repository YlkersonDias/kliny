// Espelho dos DTOs da API. Datas e horas chegam como texto ISO.

export interface User {
  id: number
  name: string
  email: string
  createdAt: string
  // Opcionais: sessões guardadas antes do login com o Google não têm os dois (o /me completa).
  // false só em conta criada pelo Google, que não tem senha.
  hasPassword?: boolean
  googleLinked?: boolean
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
  // Gerada por um lançamento recorrente (8.5a); nula se não for, ou se a regra foi apagada.
  recurrenceId: number | null
  // Parcela de uma compra parcelada (8.5b); nula se não for, ou se a compra foi apagada.
  installmentPlanId: number | null
}

export interface TransactionRequest {
  description: string
  amount: number
  date: string
  categoryId: number | null
}

export type TransactionType = 'income' | 'expense' | 'vault'

// Lançamento recorrente (8.5a): todo mês no dia de startDate (31 cai no último dia dos meses curtos).
// amount com o sinal da movimentação; nextDate é a próxima ocorrência ainda não lançada.
export interface Recurrence {
  id: number
  description: string
  amount: number
  categoryId: number | null
  categoryName: string | null
  startDate: string
  dayOfMonth: number
  endDate: string | null
  nextDate: string
  paused: boolean
}

export interface RecurrenceCreateRequest {
  description: string
  amount: number
  startDate: string
  endDate: string | null
  categoryId: number | null
}

// Compra parcelada (8.5b): total positivo, sempre gasto. remaining: parcelas depois de hoje.
export interface InstallmentPlan {
  id: number
  description: string
  total: number
  count: number
  categoryId: number | null
  categoryName: string | null
  firstDate: string
  lastDate: string
  remaining: number
}

export interface InstallmentCreateRequest {
  description: string
  total: number
  count: number
  firstDate: string
  categoryId: number | null
}

export interface RecurrenceUpdateRequest {
  description: string
  amount: number
  endDate: string | null
  categoryId: number | null
  paused: boolean
}

export interface TransactionQuery {
  from?: string
  to?: string
  categoryId?: number
  // Só receitas e gastos sem categoria. Não combina com categoryId, vaultId nem type=vault.
  uncategorized?: boolean
  vaultId?: number
  type?: TransactionType
  // Texto procurado na descrição (8.1); a API ignora maiúsculas e acentos.
  search?: string
  sort?: TransactionSort
  page?: number
  pageSize?: number
}

// Orçamento por categoria (8.2): limite mensal e o gasto do mês pedido (positivo, sem operações de cofre).
export interface Budget {
  categoryId: number
  categoryName: string
  limit: number
  spent: number
}

// Lista fechada aceita pela API; ausente = mais recentes primeiro.
export type TransactionSort = 'date-desc' | 'date-asc' | 'amount-desc' | 'amount-asc'

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

export type CategoryReportType = 'expense' | 'income'

// categoryId e categoryName nulos = sem categoria (o texto fica no frontend). total sempre
// positivo, também para gastos; percentage com 2 casas (a soma pode não dar 100).
export interface CategoryTotal {
  categoryId: number | null
  categoryName: string | null
  total: number
  count: number
  percentage: number
}

// Formato de erro do ASP.NET Core. `errors` só vem nas falhas de validação.
export interface ProblemDetails {
  type?: string
  title?: string
  status?: number
  detail?: string
  errors?: Record<string, string[]>
}
