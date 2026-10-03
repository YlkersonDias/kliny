import { ApiError } from '../api/client'

export type FieldErrors<F extends string> = Partial<Record<F, string>>

// Separa o erro da API em erros por campo (só os campos do formulário) e uma mensagem geral.
export function splitApiError<F extends string>(
  error: unknown,
  fields: readonly F[],
): { fieldErrors: FieldErrors<F>; formError: string | null } {
  if (!(error instanceof ApiError)) {
    return { fieldErrors: {}, formError: 'Não foi possível concluir a operação. Tente novamente.' }
  }

  const fieldErrors: FieldErrors<F> = {}
  for (const field of fields) {
    const message = error.fieldErrors[field]
    if (message) fieldErrors[field] = message
  }

  // Se algum erro não pertence a um campo visível, a mensagem geral também aparece.
  const allShown = Object.keys(error.fieldErrors).length > 0
    && Object.keys(error.fieldErrors).every((key) => (fields as readonly string[]).includes(key))
  return { fieldErrors, formError: allShown ? null : error.detail }
}

// Primeiro campo com erro, na ordem em que aparece na tela.
export function firstInvalidField<F extends string>(errors: FieldErrors<F>, fields: readonly F[]): F | undefined {
  return fields.find((field) => errors[field])
}
