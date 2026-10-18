import { useNavigate } from 'react-router'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../auth/useAuth'
import { TokenPasswordPage } from '../components/auth/TokenPasswordPage'
import { usePageTitle } from '../hooks/usePageTitle'

export default function CreateAccountPage() {
  const { t } = useTranslation('auth')
  usePageTitle(t('createAccount.title'))
  const navigate = useNavigate()
  const { completeSignUp } = useAuth()

  return (
    <TokenPasswordPage
      title={t('createAccount.title')}
      subtitle={t('createAccount.subtitle')}
      passwordLabel={t('fields.password')}
      submitLabel={t('createAccount.submit')}
      submittingLabel={t('createAccount.submitting')}
      missingText={t('createAccount.missing')}
      askAgainTo="/cadastro"
      askAgainLabel={t('createAccount.askAgain')}
      submit={completeSignUp}
      onSuccess={() => navigate('/', { replace: true })}
    />
  )
}
