import { useRef, useState, type FormEvent } from 'react'
import { Link, useLocation } from 'react-router'
import { useMutation } from '@tanstack/react-query'
import { ApiError } from '../api/client'
import { useAuth } from '../auth/useAuth'
import { AuthLayout } from '../components/layout/AuthLayout'
import { Button } from '../components/ui/Button'
import { FormAlert } from '../components/ui/FormAlert'
import { Input } from '../components/ui/Input'
import { usePageTitle } from '../hooks/usePageTitle'
import { firstInvalidField, splitApiError, type FieldErrors } from '../lib/forms'

const FIELDS = ['name', 'email', 'password', 'confirmPassword'] as const
type Field = (typeof FIELDS)[number]

// Mesmas regras do RegisterRequest da API.
const NAME_MAX = 100
const EMAIL_MAX = 255
const PASSWORD_MIN = 8
const PASSWORD_MAX = 72

function validate(values: Record<Field, string>): FieldErrors<Field> {
  const errors: FieldErrors<Field> = {}
  const name = values.name.trim()
  const email = values.email.trim()

  if (!name) errors.name = 'Informe o nome.'
  else if (name.length > NAME_MAX) errors.name = `O nome deve ter no máximo ${NAME_MAX} caracteres.`

  if (!email) errors.email = 'Informe o e-mail.'
  else if (!/^[^\s@]+@[^\s@]+$/.test(email)) errors.email = 'E-mail inválido.'
  else if (email.length > EMAIL_MAX) errors.email = `O e-mail deve ter no máximo ${EMAIL_MAX} caracteres.`

  if (!values.password) errors.password = 'Informe a senha.'
  else if (values.password.length < PASSWORD_MIN || values.password.length > PASSWORD_MAX) {
    errors.password = `A senha deve ter entre ${PASSWORD_MIN} e ${PASSWORD_MAX} caracteres.`
  }

  // Conferido só aqui: a API não recebe a confirmação.
  if (!values.confirmPassword) errors.confirmPassword = 'Confirme a senha.'
  else if (values.confirmPassword !== values.password) errors.confirmPassword = 'As senhas não conferem.'

  return errors
}

export default function RegisterPage() {
  usePageTitle('Criar conta')
  const { signUp } = useAuth()
  const location = useLocation()
  const [values, setValues] = useState<Record<Field, string>>({
    name: '', email: '', password: '', confirmPassword: '',
  })
  const [errors, setErrors] = useState<FieldErrors<Field>>({})
  const [formError, setFormError] = useState<string | null>(null)
  const nameRef = useRef<HTMLInputElement>(null)
  const emailRef = useRef<HTMLInputElement>(null)
  const passwordRef = useRef<HTMLInputElement>(null)
  const confirmPasswordRef = useRef<HTMLInputElement>(null)
  const mutation = useMutation({ mutationFn: signUp })

  function showErrors(fieldErrors: FieldErrors<Field>) {
    setErrors(fieldErrors)
    const refs = { name: nameRef, email: emailRef, password: passwordRef, confirmPassword: confirmPasswordRef }
    const first = firstInvalidField(fieldErrors, FIELDS)
    if (first) refs[first].current?.focus()
  }

  function change(field: Field, value: string) {
    setValues((current) => ({ ...current, [field]: value }))
    setErrors((current) => ({ ...current, [field]: undefined }))
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setFormError(null)

    const fieldErrors = validate(values)
    showErrors(fieldErrors)
    if (firstInvalidField(fieldErrors, FIELDS)) return

    // Depois do cadastro o usuário já entra logado; o PublicOnlyRoute faz o redirecionamento.
    mutation.mutate({ name: values.name.trim(), email: values.email.trim(), password: values.password }, {
      onError: (error) => {
        if (error instanceof ApiError && error.status === 409) {
          showErrors({ email: error.detail })
          return
        }
        const result = splitApiError(error, FIELDS)
        showErrors(result.fieldErrors)
        setFormError(result.formError)
      },
    })
  }

  return (
    <AuthLayout title="Criar conta" subtitle="Comece a organizar suas finanças.">
      <form noValidate onSubmit={handleSubmit} className="space-y-4">
        {formError && <FormAlert>{formError}</FormAlert>}

        <Input
          ref={nameRef}
          label="Nome"
          autoComplete="name"
          value={values.name}
          onChange={(event) => change('name', event.target.value)}
          error={errors.name}
        />
        <Input
          ref={emailRef}
          label="E-mail"
          type="email"
          autoComplete="email"
          value={values.email}
          onChange={(event) => change('email', event.target.value)}
          error={errors.email}
        />
        <Input
          ref={passwordRef}
          label="Senha"
          type="password"
          autoComplete="new-password"
          hint={`De ${PASSWORD_MIN} a ${PASSWORD_MAX} caracteres.`}
          value={values.password}
          onChange={(event) => change('password', event.target.value)}
          error={errors.password}
        />
        <Input
          ref={confirmPasswordRef}
          label="Confirmar senha"
          type="password"
          autoComplete="new-password"
          value={values.confirmPassword}
          onChange={(event) => change('confirmPassword', event.target.value)}
          error={errors.confirmPassword}
        />

        <Button type="submit" className="w-full" isLoading={mutation.isPending}>
          {mutation.isPending ? 'Criando conta…' : 'Criar conta'}
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-muted">
        Já tem conta?{' '}
        <Link to="/entrar" state={location.state} className="font-semibold text-primary underline-offset-2 hover:underline">
          Entrar
        </Link>
      </p>
    </AuthLayout>
  )
}
