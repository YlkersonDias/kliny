import { getSessionToken } from '../auth/session'
import i18n, { currentLanguage } from '../i18n'
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
  // Cabeçalhos extras, como o Idempotency-Key do depósito e da retirada.
  headers?: Record<string, string>
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const response = await send(path, options)
  // 204, ou 202 do pedido de cadastro: sucesso sem corpo.
  const text = await response.text()
  if (!text) return undefined as T
  return JSON.parse(text) as T
}

// Resposta que é um arquivo (a exportação dos dados), com os mesmos erros e o mesmo 401 do apiRequest.
export async function apiBlob(path: string, options: RequestOptions = {}): Promise<Blob> {
  const response = await send(path, options)
  return response.blob()
}

async function send(
  path: string,
  { method = 'GET', body, auth = true, signal, headers: extraHeaders }: RequestOptions,
): Promise<Response> {
  const token = auth ? getSessionToken() : null
  // Accept-Language: a API responde as mensagens de erro no idioma da tela.
  const headers = new Headers({ Accept: 'application/json', 'Accept-Language': currentLanguage() })
  if (token) headers.set('Authorization', `Bearer ${token}`)
  if (body !== undefined) headers.set('Content-Type', 'application/json')
  for (const [name, value] of Object.entries(extraHeaders ?? {})) headers.set(name, value)

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
    throw new ApiError(0, i18n.t('errors:network'))
  }

  if (!response.ok) {
    const problem = await readProblem(response)
    // Só encerra a sessão se o token enviado ainda é o atual (e não de um usuário que já saiu).
    if (response.status === 401 && token !== null && token === getSessionToken()) {
      unauthorizedHandler?.()
    }
    throw toApiError(response.status, problem)
  }
  return response
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
  const detail = problem?.detail ?? (hasFieldErrors ? i18n.t('errors:checkFields') : defaultMessage(status))
  return new ApiError(status, detail, fieldErrors)
}

function defaultMessage(status: number): string {
  if (status >= 500) return i18n.t('errors:server')
  switch (status) {
    case 400: return i18n.t('errors:badRequest')
    case 401: return i18n.t('errors:sessionExpired')
    case 403: return i18n.t('errors:forbidden')
    case 404: return i18n.t('errors:notFound')
    case 409: return i18n.t('errors:conflict')
    // A API manda o tempo de espera no detail; este texto é só para resposta sem ele.
    case 429: return i18n.t('errors:tooManyRequests')
    default: return i18n.t('errors:generic')
  }
}
