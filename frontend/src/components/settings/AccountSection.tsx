import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate } from 'react-router'
import { useAuth } from '../../auth/useAuth'
import { Button } from '../ui/Button'
import { ConfirmDialog } from '../ui/ConfirmDialog'
import { Input } from '../ui/Input'

// "Privacidade e conta" em /configuracoes: link para a política e a exclusão da conta.
// Excluir exige a senha e marcar a caixa de que nada pode ser desfeito; a sessão só termina
// depois que a API confirmou (como no "Sair de todos os dispositivos").
export function AccountSection() {
  const { t } = useTranslation('settings')
  const { deleteAccount } = useAuth()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [password, setPassword] = useState('')
  const [understood, setUnderstood] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function openDialog() {
    setPassword('')
    setUnderstood(false)
    setError(null)
    setOpen(true)
  }

  async function handleDelete(event?: FormEvent) {
    event?.preventDefault()
    if (!password || !understood) return
    setDeleting(true)
    setError(null)
    try {
      await deleteAccount(password)
      // Como o "Sair": vai para o login sem guardar esta página para depois.
      navigate('/entrar', { replace: true })
    } catch (caught) {
      // A API explica o motivo (senha incorreta, muitas tentativas, sem conexão).
      setError(caught instanceof Error && caught.message ? caught.message : t('account.error'))
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
      <p className="mt-4 text-sm text-muted">{t('account.deleteDescription')}</p>
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
          confirmDisabled={!password || !understood}
        >
          <p>{t('account.confirmText')}</p>
          <form onSubmit={(event) => void handleDelete(event)} className="mt-4 space-y-4">
            <Input
              id="excluir-conta-senha"
              type="password"
              autoComplete="current-password"
              label={t('account.password')}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              disabled={deleting}
            />
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
