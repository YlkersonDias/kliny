import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '../components/ui/Button'
import { EmptyState } from '../components/ui/EmptyState'
import { Icon } from '../components/ui/Icon'
import { Spinner } from '../components/ui/Spinner'
import { VaultCard } from '../components/vaults/VaultCard'
import { VaultDialogs, type VaultDialog } from '../components/vaults/VaultDialogs'
import { usePageTitle } from '../hooks/usePageTitle'
import { useVaults } from '../hooks/useVaults'
import { formatMoney } from '../lib/money'
import { sumMoney } from '../lib/vaults'

export default function VaultsPage() {
  const { t } = useTranslation(['vaults', 'common'])
  usePageTitle(t('title'))
  const vaults = useVaults()
  const [dialog, setDialog] = useState<VaultDialog>(null)

  const newButton = (
    <Button onClick={() => setDialog({ kind: 'form' })}>
      <Icon name="plus" className="size-4" />
      {t('newButton')}
    </Button>
  )

  function renderContent() {
    if (vaults.isPending) {
      return (
        <div className="flex justify-center rounded-2xl border border-border bg-surface py-16 text-primary" role="status">
          <Spinner className="size-8" />
          <span className="sr-only">{t('loading')}</span>
        </div>
      )
    }
    if (vaults.isError) {
      return (
        <div className="rounded-2xl border border-border bg-surface">
          <EmptyState
            role="alert"
            image="erro"
            title={t('loadError')}
            description={vaults.error.message}
            action={<Button variant="secondary" onClick={() => vaults.refetch()}>{t('common:actions.tryAgain')}</Button>}
          />
        </div>
      )
    }
    if (vaults.data.length === 0) {
      return (
        <div className="rounded-2xl border border-border bg-surface">
          <EmptyState
            image="cofre-vazio"
            title={t('empty.title')}
            description={t('empty.description')}
            action={newButton}
          />
        </div>
      )
    }

    return (
      <>
        <div className="rounded-2xl border border-border bg-surface p-5">
          <p className="text-sm text-muted">{t('totalSaved')}</p>
          <p className="mt-1 text-3xl font-semibold tabular-nums wrap-anywhere text-foreground">
            {formatMoney(sumMoney(vaults.data.map((vault) => vault.balance)))}
          </p>
          <p className="mt-1 text-sm text-muted">
            {t('count', { count: vaults.data.length })}
          </p>
        </div>
        {/* grid-cols-1 (minmax(0, 1fr)): sem ele, um nome longo alarga a coluna além da tela. */}
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {vaults.data.map((vault) => (
            <VaultCard
              key={vault.id}
              vault={vault}
              onOperation={(operation) => setDialog({ kind: 'operation', vault, operation })}
              onEdit={() => setDialog({ kind: 'form', vault })}
            />
          ))}
        </div>
      </>
    )
  }

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold text-foreground">{t('title')}</h1>
        {newButton}
      </div>
      <div className="mt-6">{renderContent()}</div>
      <VaultDialogs dialog={dialog} onChange={setDialog} />
    </>
  )
}
