// Espelho dos DTOs da API. Datas e horas chegam como texto ISO.

export interface User {
  id: number
  name: string
  email: string
  createdAt: string
  // Opcionais em sessões antigas; o /me completa. false só em conta criada pelo Google.
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
  color: string | null
  icon: string | null
}

export interface CategoryRequest {
  name: string
  color?: string | null
  icon?: string | null
}

// amount com o sinal da conta: receita positiva, gasto negativo; com vaultId, operação de cofre.
export interface Transaction {
  id: number
  description: string
  amount: number
  date: string // YYYY-MM-DD
  categoryId: number | null
  categoryName: string | null
  vaultId: number | null
  recurrenceId: number | null
  installmentPlanId: number | null
}

export interface TransactionRequest {
  description: string
  amount: number
  date: string
  categoryId: number | null
}

export type TransactionType = 'income' | 'expense' | 'vault'

export interface CategoryRule {
  id: number
  pattern: string
  categoryId: number
  categoryName: string
}

export interface CategoryRuleRequest {
  pattern: string
  categoryId: number
}

export interface ImportLine {
  source: string
  externalId: string | null
  date: string
  amount: number
  description: string
  occurrence: number
  categoryId?: number | null
}

export type ImportLineStatus = 'new' | 'imported' | 'similar'

export interface ImportCheckResponse {
  statuses: ImportLineStatus[]
}

export interface ImportResponse {
  created: number
  skipped: number
}

// Todo mês no dia de startDate (31 cai no último dia dos meses curtos).
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
  uncategorized?: boolean
  vaultId?: number
  type?: TransactionType
  search?: string
  sort?: TransactionSort
  page?: number
  pageSize?: number
}

export interface Budget {
  categoryId: number
  categoryName: string
  limit: number
  spent: number
}

export type TransactionSort = 'date-desc' | 'date-asc' | 'amount-desc' | 'amount-asc'

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

// amount sempre positivo: o endpoint define o sinal gravado.
export interface VaultOperationRequest {
  amount: number
  date: string
  description?: string
}

export interface VaultOperationResponse {
  transaction: Transaction
  balance: number
}

// Relatórios: expense e vaultDeposits vêm POSITIVOS, ao contrário do banco. Nunca inverter de novo.
export interface ReportPeriod {
  from: string
  to: string
}

export interface SummaryResponse {
  from: string
  to: string
  income: number
  expense: number
  net: number
  vaultDeposits: number
  vaultWithdrawals: number
  // Saldos no dia `to`, desde o primeiro lançamento.
  accountBalance: number
  vaultsBalance: number
}

export type TimelineGrouping = 'day' | 'month'

export interface TimelinePoint {
  period: string
  income: number
  expense: number
  net: number
}

export type CategoryReportType = 'expense' | 'income'

// categoryId nulo = sem categoria. total sempre positivo; a soma dos percentuais pode não dar 100.
export interface CategoryTotal {
  categoryId: number | null
  categoryName: string | null
  total: number
  count: number
  percentage: number
}

export interface ProblemDetails {
  type?: string
  title?: string
  status?: number
  detail?: string
  errors?: Record<string, string[]>
}
