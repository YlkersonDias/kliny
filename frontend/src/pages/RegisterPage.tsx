import { useRef, useState, type FormEvent } from 'react'
import { Link, useLocation } from 'react-router'
import { useMutation } from '@tanstack/react-query'
import type { TFunction } from 'i18next'
import { Trans, useTranslation } from 'react-i18next'
import { ApiError } from '../api/client'
import { useAuth } from '../auth/useAuth'
import { GoogleSignIn } from '../components/auth/GoogleSignIn'
import { AuthLayout } from '../components/layout/AuthLayout'
import { Button } from '../components/ui/Button'
import { FormAlert } from '../components/ui/FormAlert'
import { Input } from '../components/ui/Input'
import { usePageTitle } from '../hooks/usePageTitle'
import { firstInvalidField, splitApiError, type FieldErrors } from '../lib/forms'
import { exceedsPasswordBytes } from '../lib/password'

const FIELDS = ['name', 'email', 'password', 'confirmPassword'] as const
type Field = (typeof FIELDS)[number]

// Mesmas regras do RegisterRequest da API.
const NAME_MAX = 100
const EMAIL_MAX = 255
const PASSWORD_MIN = 8
const PASSWORD_MAX = 72

function validate(values: Record<Field, string>, t: TFunction<'auth'>): FieldErrors<Field> {
  const errors: FieldErrors<Field> = {}
  const name = values.name.trim()
  const email = values.email.trim()

  if (!name) errors.name = t('validation.nameRequired')
  else if (name.length > NAME_MAX) errors.name = t('validation.nameMax', { max: NAME_MAX })

  if (!email) errors.email = t('validation.emailRequired')
  else if (!/^[^\s@]+@[^\s@]+$/.test(email)) errors.email = t('validation.emailInvalid')
  else if (email.length > EMAIL_MAX) errors.email = t('validation.emailMax', { max: EMAIL_MAX })

  if (!values.password) errors.password = t('validation.passwordRequired')
  else if (values.password.length < PASSWORD_MIN || values.password.length > PASSWORD_MAX) {
    errors.password = t('validation.passwordLength', { min: PASSWORD_MIN, max: PASSWORD_MAX })
  } else if (exceedsPasswordBytes(values.password)) {
    errors.password = t('validation.passwordTooLong')
  }

  // Conferido só aqui: a API não recebe a confirmação.
  if (!values.confirmPassword) errors.confirmPassword = t('validation.confirmRequired')
  else if (values.confirmPassword !== values.password) errors.confirmPassword = t('validation.confirmMismatch')

  return errors
}

export default function RegisterPage() {
  const { t } = useTranslation('auth')
  usePageTitle(t('register.title'))
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

    const fieldErrors = validate(values, t)
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
    <AuthLayout title={t('register.title')} subtitle={t('register.subtitle')}>
      <form noValidate onSubmit={handleSubmit} className="space-y-4">
        {formError && <FormAlert>{formError}</FormAlert>}

        <Input
          ref={nameRef}
          label={t('fields.name')}
          autoComplete="name"
          value={values.name}
          onChange={(event) => change('name', event.target.value)}
          error={errors.name}
        />
        <Input
          ref={emailRef}
          label={t('fields.email')}
          type="email"
          autoComplete="email"
          value={values.email}
          onChange={(event) => change('email', event.target.value)}
          error={errors.email}
        />
        <Input
          ref={passwordRef}
          label={t('fields.password')}
          type="password"
          autoComplete="new-password"
          hint={t('register.passwordHint', { min: PASSWORD_MIN, max: PASSWORD_MAX })}
          value={values.password}
          onChange={(event) => change('password', event.target.value)}
          error={errors.password}
        />
        <Input
          ref={confirmPasswordRef}
          label={t('fields.confirmPassword')}
          type="password"
          autoComplete="new-password"
          value={values.confirmPassword}
          onChange={(event) => change('confirmPassword', event.target.value)}
          error={errors.confirmPassword}
        />

        <Button type="submit" className="w-full" isLoading={mutation.isPending}>
          {mutation.isPending ? t('register.submitting') : t('register.submit')}
        </Button>
      </form>

      <GoogleSignIn text="signup_with" />

      <p className="mt-4 text-center text-xs text-muted">
        <Trans
          t={t}
          i18nKey="register.privacyNotice"
          components={{ link: <Link to="/privacidade" className="font-semibold text-primary underline-offset-2 hover:underline" /> }}
        />
      </p>

      <p className="mt-6 text-center text-sm text-muted">
        {t('register.hasAccount')}{' '}
        <Link to="/entrar" state={location.state} className="font-semibold text-primary underline-offset-2 hover:underline">
          {t('register.signIn')}
        </Link>
      </p>
    </AuthLayout>
  )
}
