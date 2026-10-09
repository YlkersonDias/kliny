import { useMutation } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { linkGoogle, unlinkGoogle } from '../../api/auth'
import { useAuth } from '../../auth/useAuth'
import { isGoogleEnabled } from '../../lib/googleIdentity'
import { Button } from '../ui/Button'
import { FormAlert } from '../ui/FormAlert'
import { GoogleButton } from '../ui/GoogleButton'

// "Conta Google" em /configuracoes: vincular (entrar também com o Google) ou desvincular.
// Conta sem senha (criada pelo Google) não desvincula: ficaria sem forma de entrar.
export function GoogleSection() {
  const { t } = useTranslation('settings')
  const { user, updateUser } = useAuth()
  const link = useMutation({ mutationFn: linkGoogle, onSuccess: updateUser })
  const unlink = useMutation({ mutationFn: unlinkGoogle, onSuccess: updateUser })

  if (!isGoogleEnabled || user === null) return null
  const linked = user.googleLinked === true
  const hasPassword = user.hasPassword !== false
  const error = link.error ?? unlink.error

  return (
    <section aria-labelledby="conta-google" className="mt-6 rounded-2xl border border-border bg-surface p-5 sm:p-6">
      <h2 id="conta-google" className="text-lg font-semibold text-foreground">{t('google.title')}</h2>
      <p className="mt-2 text-sm text-muted">
        {linked ? (hasPassword ? t('google.linked') : t('google.linkedOnly')) : t('google.notLinked')}
      </p>
      {error && <div className="mt-4"><FormAlert>{error.message || t('google.error')}</FormAlert></div>}
      <div className="mt-4 max-w-sm">
        {linked ? (
          hasPassword && (
            <Button variant="secondary" isLoading={unlink.isPending} onClick={() => { link.reset(); unlink.mutate() }}>
              {t('google.unlink')}
            </Button>
          )
        ) : (
          <GoogleButton
            text="continue_with"
            disabled={link.isPending}
            onCredential={(credential) => { unlink.reset(); link.mutate(credential) }}
          />
        )}
      </div>
    </section>
  )
}
