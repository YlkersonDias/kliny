import { useRef, useState, type FormEvent } from 'react'
import { Link, useLocation } from 'react-router'
import { useMutation } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../auth/useAuth'
import { GoogleSignIn } from '../components/auth/GoogleSignIn'
import { AuthLayout } from '../components/layout/AuthLayout'
import { Button } from '../components/ui/Button'
import { FormAlert } from '../components/ui/FormAlert'
import { Input } from '../components/ui/Input'
import { usePageTitle } from '../hooks/usePageTitle'
import { firstInvalidField, splitApiError, type FieldErrors } from '../lib/forms'

const FIELDS = ['email', 'password'] as const
type Field = (typeof FIELDS)[number]

export default function LoginPage() {
  const { t } = useTranslation('auth')
  usePageTitle(t('login.title'))
  const { signIn, notice } = useAuth()
  const location = useLocation()
  const passwordReset = (location.state as { passwordReset?: boolean } | null)?.passwordReset === true
  const [values, setValues] = useState<Record<Field, string>>({ email: '', password: '' })
  const [errors, setErrors] = useState<FieldErrors<Field>>({})
  const [formError, setFormError] = useState<string | null>(null)
  const emailRef = useRef<HTMLInputElement>(null)
  const passwordRef = useRef<HTMLInputElement>(null)
  const mutation = useMutation({ mutationFn: signIn })

  function showErrors(fieldErrors: FieldErrors<Field>) {
    setErrors(fieldErrors)
    const refs = { email: emailRef, password: passwordRef }
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

    const email = values.email.trim()
    const fieldErrors: FieldErrors<Field> = {}
    if (!email) fieldErrors.email = t('validation.emailRequired')
    if (!values.password) fieldErrors.password = t('validation.passwordRequired')
    showErrors(fieldErrors)
    if (firstInvalidField(fieldErrors, FIELDS)) return

    // O PublicOnlyRoute leva para a página que o usuário tentou abrir.
    mutation.mutate({ email, password: values.password }, {
      onError: (error) => {
        const result = splitApiError(error, FIELDS)
        showErrors(result.fieldErrors)
        setFormError(result.formError)
      },
    })
  }

  return (
    <AuthLayout title={t('login.title')} subtitle={t('login.subtitle')} mascot>
      <form noValidate onSubmit={handleSubmit} className="space-y-4">
        {passwordReset && !formError && <FormAlert variant="info">{t('reset.done')}</FormAlert>}
        {notice && !passwordReset && !formError && <FormAlert variant="info">{notice}</FormAlert>}
        {formError && <FormAlert>{formError}</FormAlert>}

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
          autoComplete="current-password"
          value={values.password}
          onChange={(event) => change('password', event.target.value)}
          error={errors.password}
        />

        <Button type="submit" className="w-full" isLoading={mutation.isPending}>
          {mutation.isPending ? t('login.submitting') : t('login.submit')}
        </Button>
        <p className="text-center text-sm">
          <Link to="/esqueci-senha" className="font-semibold text-primary underline-offset-2 hover:underline">
            {t('login.forgot')}
          </Link>
        </p>
      </form>

      <GoogleSignIn text="signin_with" showPrivacyNotice />

      <p className="mt-6 text-center text-sm text-muted">
        {t('login.noAccount')}{' '}
        <Link to="/cadastro" state={location.state} className="font-semibold text-primary underline-offset-2 hover:underline">
          {t('login.createAccount')}
        </Link>
      </p>
    </AuthLayout>
  )
}
