import { useRef, useState, type FormEvent } from 'react'
import { Link, useLocation } from 'react-router'
import { useMutation } from '@tanstack/react-query'
import type { TFunction } from 'i18next'
import { Trans, useTranslation } from 'react-i18next'
import { register } from '../api/auth'
import { GoogleSignIn } from '../components/auth/GoogleSignIn'
import { AuthLayout } from '../components/layout/AuthLayout'
import { Button } from '../components/ui/Button'
import { FormAlert } from '../components/ui/FormAlert'
import { Input } from '../components/ui/Input'
import { usePageTitle } from '../hooks/usePageTitle'
import { firstInvalidField, splitApiError, type FieldErrors } from '../lib/forms'

const FIELDS = ['name', 'email'] as const
type Field = (typeof FIELDS)[number]

const NAME_MAX = 100
const EMAIL_MAX = 255

function validate(values: Record<Field, string>, t: TFunction<'auth'>): FieldErrors<Field> {
  const errors: FieldErrors<Field> = {}
  const name = values.name.trim()
  const email = values.email.trim()

  if (!name) errors.name = t('validation.nameRequired')
  else if (name.length > NAME_MAX) errors.name = t('validation.nameMax', { max: NAME_MAX })

  if (!email) errors.email = t('validation.emailRequired')
  else if (!/^[^\s@]+@[^\s@]+$/.test(email)) errors.email = t('validation.emailInvalid')
  else if (email.length > EMAIL_MAX) errors.email = t('validation.emailMax', { max: EMAIL_MAX })

  return errors
}

// A resposta é sempre a mesma, tenha o e-mail conta ou não; a senha é escolhida no link do e-mail.
export default function RegisterPage() {
  const { t } = useTranslation('auth')
  usePageTitle(t('register.title'))
  const location = useLocation()
  const [values, setValues] = useState<Record<Field, string>>({ name: '', email: '' })
  const [errors, setErrors] = useState<FieldErrors<Field>>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [sent, setSent] = useState(false)
  const nameRef = useRef<HTMLInputElement>(null)
  const emailRef = useRef<HTMLInputElement>(null)
  const mutation = useMutation({ mutationFn: register })

  function showErrors(fieldErrors: FieldErrors<Field>) {
    setErrors(fieldErrors)
    const refs = { name: nameRef, email: emailRef }
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

    mutation.mutate({ name: values.name.trim(), email: values.email.trim() }, {
      onSuccess: () => setSent(true),
      onError: (error) => {
        const result = splitApiError(error, FIELDS)
        showErrors(result.fieldErrors)
        setFormError(result.formError)
      },
    })
  }

  return (
    <AuthLayout title={t('register.title')} subtitle={t('register.subtitle')}>
      {sent ? (
        <div className="space-y-4">
          <FormAlert variant="info">{t('register.sent')}</FormAlert>
          <p className="text-sm text-muted">{t('register.sentHint')}</p>
        </div>
      ) : (
        <>
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
        </>
      )}

      <p className="mt-6 text-center text-sm text-muted">
        {t('register.hasAccount')}{' '}
        <Link to="/entrar" state={location.state} className="font-semibold text-primary underline-offset-2 hover:underline">
          {t('register.signIn')}
        </Link>
      </p>
    </AuthLayout>
  )
}
