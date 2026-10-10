import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router'
import { useMutation } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { resetPassword } from '../api/auth'
import { ApiError } from '../api/client'
import { useAuth } from '../auth/useAuth'
import { AuthLayout } from '../components/layout/AuthLayout'
import { Button } from '../components/ui/Button'
import { FormAlert } from '../components/ui/FormAlert'
import { Input } from '../components/ui/Input'
import { usePageTitle } from '../hooks/usePageTitle'
import { firstInvalidField, splitApiError, type FieldErrors } from '../lib/forms'
import { exceedsPasswordBytes, PASSWORD_MAX, PASSWORD_MIN } from '../lib/password'

const FIELDS = ['password', 'confirmPassword'] as const
type Field = (typeof FIELDS)[number]

// O token chega depois do "#" (o navegador não o manda a servidor nenhum): lido uma vez e tirado
// da barra de endereço, para não ficar no histórico nem aparecer num print da tela.
function readToken(): string {
  return decodeURIComponent(window.location.hash.replace(/^#/, ''))
}

export default function ResetPasswordPage() {
  const { t } = useTranslation('auth')
  usePageTitle(t('reset.title'))
  const navigate = useNavigate()
  const { user, signOut } = useAuth()
  const [token, setToken] = useState(readToken)
  const [values, setValues] = useState<Record<Field, string>>({ password: '', confirmPassword: '' })
  const [errors, setErrors] = useState<FieldErrors<Field>>({})
  const [formError, setFormError] = useState<string | null>(null)
  const passwordRef = useRef<HTMLInputElement>(null)
  const confirmRef = useRef<HTMLInputElement>(null)
  const mutation = useMutation({ mutationFn: (password: string) => resetPassword(token, password) })

  // Tira o token da barra de endereço. Um link aberto com a página já aberta só muda o "#", sem
  // recarregar: o hashchange pega o token novo.
  useEffect(() => {
    function takeToken() {
      if (!window.location.hash) return
      const next = readToken()
      window.history.replaceState(window.history.state, '', window.location.pathname)
      if (next) setToken(next)
    }
    takeToken()
    window.addEventListener('hashchange', takeToken)
    return () => window.removeEventListener('hashchange', takeToken)
  }, [])

  function showErrors(fieldErrors: FieldErrors<Field>) {
    setErrors(fieldErrors)
    const refs = { password: passwordRef, confirmPassword: confirmRef }
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
    const fieldErrors: FieldErrors<Field> = {}
    const { password, confirmPassword } = values
    if (!password) fieldErrors.password = t('validation.passwordRequired')
    else if (password.length < PASSWORD_MIN || password.length > PASSWORD_MAX) {
      fieldErrors.password = t('validation.passwordLength', { min: PASSWORD_MIN, max: PASSWORD_MAX })
    } else if (exceedsPasswordBytes(password)) fieldErrors.password = t('validation.passwordTooLong')
    if (!confirmPassword) fieldErrors.confirmPassword = t('validation.confirmRequired')
    else if (confirmPassword !== password) fieldErrors.confirmPassword = t('validation.confirmMismatch')
    showErrors(fieldErrors)
    if (firstInvalidField(fieldErrors, FIELDS)) return

    mutation.mutate(password, {
      onSuccess: () => {
        // Todas as sessões da conta caíram; se esta aba estava logada, sai também.
        if (user) signOut()
        navigate('/entrar', { replace: true, state: { passwordReset: true } })
      },
      onError: (error) => {
        const result = splitApiError(error, ['password'] as const)
        showErrors(result.fieldErrors)
        // Link malformado vem como erro do campo "token", que não está na tela.
        const tokenError = error instanceof ApiError ? error.fieldErrors.token : undefined
        setFormError(tokenError ?? result.formError)
      },
    })
  }

  if (!token) {
    return (
      <AuthLayout title={t('reset.title')} subtitle={t('reset.subtitle')}>
        <FormAlert>{t('reset.missing')}</FormAlert>
        <p className="mt-6 text-center text-sm">
          <Link to="/esqueci-senha" className="font-semibold text-primary underline-offset-2 hover:underline">{t('reset.askAgain')}</Link>
        </p>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout title={t('reset.title')} subtitle={t('reset.subtitle')}>
      <form noValidate onSubmit={handleSubmit} className="space-y-4">
        {formError && (
          <FormAlert>
            {formError}{' '}
            <Link to="/esqueci-senha" className="font-semibold underline underline-offset-2">{t('reset.askAgain')}</Link>
          </FormAlert>
        )}
        <Input
          ref={passwordRef}
          label={t('reset.newPassword')}
          type="password"
          autoComplete="new-password"
          hint={t('register.passwordHint', { min: PASSWORD_MIN, max: PASSWORD_MAX })}
          value={values.password}
          onChange={(event) => change('password', event.target.value)}
          error={errors.password}
        />
        <Input
          ref={confirmRef}
          label={t('fields.confirmPassword')}
          type="password"
          autoComplete="new-password"
          value={values.confirmPassword}
          onChange={(event) => change('confirmPassword', event.target.value)}
          error={errors.confirmPassword}
        />
        <Button type="submit" className="w-full" isLoading={mutation.isPending}>
          {mutation.isPending ? t('reset.submitting') : t('reset.submit')}
        </Button>
      </form>
    </AuthLayout>
  )
}
