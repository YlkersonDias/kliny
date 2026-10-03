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

// Formato de erro do ASP.NET Core. `errors` só vem nas falhas de validação.
export interface ProblemDetails {
  type?: string
  title?: string
  status?: number
  detail?: string
  errors?: Record<string, string[]>
}
