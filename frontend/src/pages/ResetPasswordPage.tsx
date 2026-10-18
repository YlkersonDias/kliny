import { useNavigate } from 'react-router'
import { useTranslation } from 'react-i18next'
import { resetPassword } from '../api/auth'
import { useAuth } from '../auth/useAuth'
import { TokenPasswordPage } from '../components/auth/TokenPasswordPage'
import { usePageTitle } from '../hooks/usePageTitle'

export default function ResetPasswordPage() {
  const { t } = useTranslation('auth')
  usePageTitle(t('reset.title'))
  const navigate = useNavigate()
  const { user, signOut } = useAuth()

  return (
    <TokenPasswordPage
      title={t('reset.title')}
      subtitle={t('reset.subtitle')}
      passwordLabel={t('reset.newPassword')}
      submitLabel={t('reset.submit')}
      submittingLabel={t('reset.submitting')}
      missingText={t('reset.missing')}
      askAgainTo="/esqueci-senha"
      askAgainLabel={t('reset.askAgain')}
      submit={resetPassword}
      onSuccess={() => {
        // Todas as sessões da conta caíram; se esta aba estava logada, sai também.
        if (user) signOut()
        navigate('/entrar', { replace: true, state: { passwordReset: true } })
      }}
    />
  )
}
