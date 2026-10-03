import { getSessionToken } from '../auth/session'
import type { ProblemDetails } from './types'

export class ApiError extends Error {
  readonly status: number
  readonly detail: string
  // Primeira mensagem de cada campo, com o nome em camelCase (`Email` vira `email`).
  readonly fieldErrors: Record<string, string>

  constructor(status: number, detail: string, fieldErrors: Record<string, string> = {}) {
    super(detail)
    this.name = 'ApiError'
    this.status = status
    this.detail = detail
    this.fieldErrors = fieldErrors
  }
}

let unauthorizedHandler: (() => void) | null = null

// Chamado quando uma requisição feita com token recebe 401.
export function setUnauthorizedHandler(handler: (() => void) | null): void {
  unauthorizedHandler = handler
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE'
  body?: unknown
  // false nas rotas públicas (login e cadastro): não envia token.
  auth?: boolean
  signal?: AbortSignal
}

export async function apiRequest<T>(
  path: string,
  { method = 'GET', body, auth = true, signal }: RequestOptions = {},
): Promise<T> {
  const token = auth ? getSessionToken() : null
  const headers = new Headers({ Accept: 'application/json' })
  if (token) headers.set('Authorization', `Bearer ${token}`)
  if (body !== undefined) headers.set('Content-Type', 'application/json')

  let response: Response
  try {
    response = await fetch(`/api${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal,
    })
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error
    throw new ApiError(0, 'Não foi possível conectar ao servidor. Verifique sua conexão e tente novamente.')
  }

  if (!response.ok) {
    const problem = await readProblem(response)
    // Só encerra a sessão se o token enviado ainda é o atual (e não de um usuário que já saiu).
    if (response.status === 401 && token !== null && token === getSessionToken()) {
      unauthorizedHandler?.()
    }
    throw toApiError(response.status, problem)
  }

  if (response.status === 204) return undefined as T
  return (await response.json()) as T
}

async function readProblem(response: Response): Promise<ProblemDetails | null> {
  if (!response.headers.get('Content-Type')?.includes('json')) return null
  try {
    return (await response.json()) as ProblemDetails
  } catch {
    return null
  }
}

// `$.name` (erro de leitura do JSON) e `Email` (validação) viram `name` e `email`.
function toFieldName(key: string): string {
  const last = key.replace(/^\$\./, '').split('.').pop() ?? key
  return last.charAt(0).toLowerCase() + last.slice(1)
}

function toApiError(status: number, problem: ProblemDetails | null): ApiError {
  const fieldErrors: Record<string, string> = {}
  for (const [key, messages] of Object.entries(problem?.errors ?? {})) {
    // `request` é o corpo inteiro, não um campo do formulário.
    if (key === 'request' || messages.length === 0) continue
    fieldErrors[toFieldName(key)] ??= messages[0]
  }

  const hasFieldErrors = Object.keys(fieldErrors).length > 0
  const detail = problem?.detail ?? (hasFieldErrors ? 'Confira os campos destacados.' : defaultMessage(status))
  return new ApiError(status, detail, fieldErrors)
}

function defaultMessage(status: number): string {
  if (status >= 500) return 'Erro no servidor. Tente novamente em instantes.'
  switch (status) {
    case 400: return 'Dados inválidos.'
    case 401: return 'Sua sessão expirou. Entre novamente.'
    case 403: return 'Você não tem permissão para isso.'
    case 404: return 'Registro não encontrado.'
    case 409: return 'Os dados entram em conflito com um registro existente.'
    default: return 'Não foi possível concluir a operação.'
  }
}
