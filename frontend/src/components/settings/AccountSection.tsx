import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate } from 'react-router'
import { useAuth } from '../../auth/useAuth'
import { Button } from '../ui/Button'
import { ConfirmDialog } from '../ui/ConfirmDialog'
import { GoogleButton } from '../ui/GoogleButton'
import { Input } from '../ui/Input'
import { ExportData } from './ExportData'

// "Privacidade e conta" em /configuracoes: link para a política, a cópia dos dados e a exclusão da conta.
// Excluir exige a senha (ou, em conta criada pelo Google, entrar de novo com o Google) e marcar a
// caixa de que nada pode ser desfeito; a sessão só termina depois que a API confirmou (como no
// "Sair de todos os dispositivos").
export function AccountSection() {
  const { t } = useTranslation('settings')
  const { user, deleteAccount } = useAuth()
  const hasPassword = user?.hasPassword !== false
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [password, setPassword] = useState('')
  const [googleCredential, setGoogleCredential] = useState<string | null>(null)
  const [understood, setUnderstood] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function openDialog() {
    setPassword('')
    setGoogleCredential(null)
    setUnderstood(false)
    setError(null)
    setOpen(true)
  }

  const confirmed = hasPassword ? password !== '' : googleCredential !== null

  async function handleDelete(event?: FormEvent) {
    event?.preventDefault()
    if (!confirmed || !understood) return
    setDeleting(true)
    setError(null)
    try {
      await deleteAccount(hasPassword ? { password } : { googleCredential: googleCredential ?? undefined })
      // Como o "Sair": vai para o login sem guardar esta página para depois.
      navigate('/entrar', { replace: true })
    } catch (caught) {
      // A API explica o motivo (senha incorreta, muitas tentativas, sem conexão).
      setError(caught instanceof Error && caught.message ? caught.message : t('account.error'))
      // O comprovante do Google vale uma vez: em caso de erro, a pessoa confirma de novo.
      setGoogleCredential(null)
      setDeleting(false)
    }
  }

  return (
    <section aria-labelledby="conta" className="mt-6 rounded-2xl border border-border bg-surface p-5 sm:p-6">
      <h2 id="conta" className="text-lg font-semibold text-foreground">{t('account.title')}</h2>
      <p className="mt-2 text-sm">
        <Link to="/privacidade" className="font-semibold text-primary underline-offset-2 hover:underline">
          {t('account.privacyLink')}
        </Link>
      </p>
      <ExportData />
      <p className="mt-6 text-sm text-muted">{t('account.deleteDescription')}</p>
      <Button variant="danger" className="mt-4" onClick={openDialog}>
        {t('account.deleteButton')}
      </Button>

      {open && (
        <ConfirmDialog
          title={t('account.confirmTitle')}
          confirmLabel={t('account.confirm')}
          onConfirm={() => void handleDelete()}
          onCancel={() => setOpen(false)}
          isLoading={deleting}
          error={error}
          confirmDisabled={!confirmed || !understood}
        >
          <p>{hasPassword ? t('account.confirmText') : t('account.confirmTextGoogle')}</p>
          <form onSubmit={(event) => void handleDelete(event)} className="mt-4 space-y-4">
            {hasPassword ? (
              <Input
                id="excluir-conta-senha"
                type="password"
                autoComplete="current-password"
                label={t('account.password')}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                disabled={deleting}
              />
            ) : googleCredential === null ? (
              <GoogleButton text="continue_with" disabled={deleting} onCredential={setGoogleCredential} />
            ) : (
              <p role="status" className="font-medium text-foreground">{t('account.googleConfirmed')}</p>
            )}
            <label className="flex cursor-pointer items-start gap-2 text-foreground">
              <input
                id="excluir-conta-entendo"
                type="checkbox"
                checked={understood}
                onChange={(event) => setUnderstood(event.target.checked)}
                disabled={deleting}
                className="mt-0.5 size-4 shrink-0 accent-primary"
              />
              {t('account.understand')}
            </label>
          </form>
        </ConfirmDialog>
      )}
    </section>
  )
}
