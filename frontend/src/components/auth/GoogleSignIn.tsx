import { useMutation } from '@tanstack/react-query'
import { Trans, useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { useAuth } from '../../auth/useAuth'
import { isGoogleEnabled } from '../../lib/googleIdentity'
import { FormAlert } from '../ui/FormAlert'
import { GoogleButton } from '../ui/GoogleButton'

interface GoogleSignInProps {
  text: 'signin_with' | 'signup_with'
  // No login: avisa que o primeiro acesso cria a conta.
  showPrivacyNotice?: boolean
}

// O login e o cadastro usam o mesmo endpoint: a API entra na conta vinculada, vincula ou cria.
export function GoogleSignIn({ text, showPrivacyNotice = false }: GoogleSignInProps) {
  const { t } = useTranslation('auth')
  const { signInWithGoogle } = useAuth()
  const mutation = useMutation({ mutationFn: signInWithGoogle })

  if (!isGoogleEnabled) return null

  return (
    <div className="mt-6">
      <div className="flex items-center gap-3 text-sm text-muted" aria-hidden="true">
        <span className="h-px flex-1 bg-border" />
        {t('google.or')}
        <span className="h-px flex-1 bg-border" />
      </div>
      <div className="mt-4 space-y-3">
        {mutation.error && <FormAlert>{mutation.error.message || t('google.error')}</FormAlert>}
        <GoogleButton text={text} disabled={mutation.isPending} onCredential={(credential) => mutation.mutate(credential)} />
        {showPrivacyNotice && (
          <p className="text-center text-xs text-muted">
            <Trans
              t={t}
              i18nKey="google.privacyNotice"
              components={{ link: <Link to="/privacidade" className="font-semibold text-primary underline-offset-2 hover:underline" /> }}
            />
          </p>
        )}
      </div>
    </div>
  )
}
