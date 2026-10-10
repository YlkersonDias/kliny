import { useRef, useState, type FormEvent } from 'react'
import { Link } from 'react-router'
import { useMutation } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { forgotPassword } from '../api/auth'
import { AuthLayout } from '../components/layout/AuthLayout'
import { Button } from '../components/ui/Button'
import { FormAlert } from '../components/ui/FormAlert'
import { Input } from '../components/ui/Input'
import { usePageTitle } from '../hooks/usePageTitle'
import { splitApiError } from '../lib/forms'

const EMAIL_MAX = 255

// "Esqueci minha senha". A resposta é sempre a mesma, tenha o e-mail conta ou não (regra 4).
export default function ForgotPasswordPage() {
  const { t } = useTranslation('auth')
  usePageTitle(t('forgot.title'))
  const [email, setEmail] = useState('')
  const [error, setError] = useState<string | undefined>()
  const [formError, setFormError] = useState<string | null>(null)
  const [sent, setSent] = useState(false)
  const emailRef = useRef<HTMLInputElement>(null)
  const mutation = useMutation({ mutationFn: forgotPassword })

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setFormError(null)
    const value = email.trim()
    const fieldError = !value ? t('validation.emailRequired')
      : !/^[^\s@]+@[^\s@]+$/.test(value) ? t('validation.emailInvalid')
        : value.length > EMAIL_MAX ? t('validation.emailMax', { max: EMAIL_MAX })
          : undefined
    setError(fieldError)
    if (fieldError) {
      emailRef.current?.focus()
      return
    }

    mutation.mutate(value, {
      onSuccess: () => setSent(true),
      onError: (apiError) => {
        const result = splitApiError(apiError, ['email'] as const)
        setError(result.fieldErrors.email)
        setFormError(result.formError)
        if (result.fieldErrors.email) emailRef.current?.focus()
      },
    })
  }

  return (
    <AuthLayout title={t('forgot.title')} subtitle={t('forgot.subtitle')}>
      {sent ? (
        <div className="space-y-4">
          <FormAlert variant="info">{t('forgot.sent')}</FormAlert>
          <p className="text-sm text-muted">{t('forgot.sentHint')}</p>
        </div>
      ) : (
        <form noValidate onSubmit={handleSubmit} className="space-y-4">
          {formError && <FormAlert>{formError}</FormAlert>}
          <Input
            ref={emailRef}
            label={t('fields.email')}
            type="email"
            autoComplete="email"
            value={email}
            onChange={(event) => {
              setEmail(event.target.value)
              setError(undefined)
            }}
            error={error}
          />
          <Button type="submit" className="w-full" isLoading={mutation.isPending}>
            {mutation.isPending ? t('forgot.submitting') : t('forgot.submit')}
          </Button>
        </form>
      )}

      <p className="mt-6 text-center text-sm text-muted">
        <Link to="/entrar" className="font-semibold text-primary underline-offset-2 hover:underline">
          {t('forgot.backToLogin')}
        </Link>
      </p>
    </AuthLayout>
  )
}
