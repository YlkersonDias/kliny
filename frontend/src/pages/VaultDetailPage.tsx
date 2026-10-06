import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router'
import { ApiError } from '../api/client'
import type { Vault } from '../api/types'
import { Button } from '../components/ui/Button'
import { EmptyState } from '../components/ui/EmptyState'
import { Icon } from '../components/ui/Icon'
import { Pagination } from '../components/ui/Pagination'
import { Spinner } from '../components/ui/Spinner'
import { GoalProgress } from '../components/vaults/GoalProgress'
import { VaultDialogs, type VaultDialog } from '../components/vaults/VaultDialogs'
import { VaultStatement } from '../components/vaults/VaultStatement'
import { usePageTitle } from '../hooks/usePageTitle'
import { useTransactions } from '../hooks/useTransactions'
import { useVault } from '../hooks/useVaults'
import { formatTimestampDate } from '../lib/dates'
import { formatMoney } from '../lib/money'
import { PAGE_SIZE, parsePage } from '../lib/transactionFilters'
import { goalProgress } from '../lib/vaults'

// Id da URL: inteiro positivo dentro do int do banco. Qualquer outra coisa é "não encontrado".
function parseId(value: string | undefined): number | null {
  if (!value || !/^[1-9]\d{0,9}$/.test(value)) return null
  const id = Number(value)
  return id <= 2_147_483_647 ? id : null
}

function BackLink() {
  const { t } = useTranslation('vaults')
  return (
    <Link
      to="/cofres"
      className="inline-flex items-center gap-1 rounded text-sm font-semibold text-primary underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-primary"
    >
      <Icon name="chevronLeft" className="size-4" />
      {t('detail.back')}
    </Link>
  )
}

export default function VaultDetailPage() {
  const { t } = useTranslation(['vaults', 'common'])
  const id = parseId(useParams().id)
  const vault = useVault(id ?? 0, { enabled: id !== null })
  const [dialog, setDialog] = useState<VaultDialog>(null)
  const navigate = useNavigate()
  usePageTitle(vault.data?.name ?? t('detail.pageTitle'))

  const isNotFound = id === null || (vault.error instanceof ApiError && vault.error.status === 404)

  if (isNotFound) {
    return (
      <>
        <BackLink />
        <div className="mt-4 rounded-2xl border border-border bg-surface">
          <EmptyState
            image="sem-resultados"
            title={t('detail.notFoundTitle')}
            description={t('detail.notFoundDescription')}
            action={<Link to="/cofres" className="font-semibold text-primary underline-offset-2 hover:underline">{t('detail.backToVaults')}</Link>}
          />
        </div>
      </>
    )
  }

  if (vault.isError) {
    return (
      <>
        <BackLink />
        <div className="mt-4 rounded-2xl border border-border bg-surface">
          <EmptyState
            role="alert"
            image="erro"
            title={t('detail.loadError')}
            description={vault.error.message}
            action={<Button variant="secondary" onClick={() => vault.refetch()}>{t('common:actions.tryAgain')}</Button>}
          />
        </div>
      </>
    )
  }

  if (vault.isPending) {
    return (
      <>
        <BackLink />
        <div className="mt-4 flex justify-center rounded-2xl border border-border bg-surface py-16 text-primary" role="status">
          <Spinner className="size-8" />
          <span className="sr-only">{t('detail.loading')}</span>
        </div>
      </>
    )
  }

  return (
    <>
      <BackLink />
      <VaultHeader vault={vault.data} onDialog={setDialog} />
      <Statement vault={vault.data} onDeposit={() => setDialog({ kind: 'operation', vault: vault.data, operation: 'deposit' })} />
      <VaultDialogs dialog={dialog} onChange={setDialog} onDeleted={() => navigate('/cofres', { replace: true })} />
    </>
  )
}

function VaultHeader({ vault, onDialog }: { vault: Vault; onDialog: (dialog: VaultDialog) => void }) {
  const { t } = useTranslation(['vaults', 'common'])
  const reached = vault.goal !== null && goalProgress(vault.balance, vault.goal).reached

  return (
    <section className="mt-4 rounded-2xl border border-border bg-surface p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-background text-vault">
              <Icon name="vault" />
            </span>
            <div className="min-w-0">
              <h1 className="break-words text-2xl font-semibold text-foreground">{vault.name}</h1>
              {/* createdAt chega em UTC com "Z"; a data mostrada é a local. */}
              <p className="text-sm text-muted">{t('detail.createdAt', { date: formatTimestampDate(vault.createdAt) })}</p>
            </div>
          </div>
          <p className="mt-4 text-sm text-muted">{t('detail.balance')}</p>
          <p className="text-3xl font-semibold tabular-nums wrap-anywhere text-foreground">{formatMoney(vault.balance)}</p>
        </div>
        {reached && (
          <div className="flex items-center gap-3">
            {/* Pequena e decorativa: aparece em toda visita a um cofre com a meta atingida. */}
            <picture className="shrink-0">
              <source srcSet="/mascote/kliny-meta-atingida-256.webp" type="image/webp" />
              <img
                src="/mascote/kliny-meta-atingida-256.png"
                width={256}
                height={256}
                alt=""
                draggable={false}
                className="size-[100px] select-none"
              />
            </picture>
            <div>
              <p className="font-semibold text-foreground">{t('detail.goalReached')}</p>
              <p className="text-sm text-muted">{t('detail.goalReachedText', { goal: formatMoney(vault.goal!) })}</p>
            </div>
          </div>
        )}
      </div>

      <GoalProgress balance={vault.balance} goal={vault.goal} className="mt-5" />

      <div className="mt-6 flex flex-wrap gap-2">
        <Button onClick={() => onDialog({ kind: 'operation', vault, operation: 'deposit' })}>
          <Icon name="income" className="size-4" />
          {t('common:actions.deposit')}
        </Button>
        <Button variant="secondary" onClick={() => onDialog({ kind: 'operation', vault, operation: 'withdraw' })}>
          <Icon name="expense" className="size-4" />
          {t('common:actions.withdraw')}
        </Button>
        <Button variant="secondary" onClick={() => onDialog({ kind: 'form', vault })}>
          <Icon name="edit" className="size-4" />
          {t('common:actions.edit')}
        </Button>
        <Button variant="secondary" onClick={() => onDialog({ kind: 'delete', vault })}>
          <Icon name="trash" className="size-4" />
          {t('common:actions.delete')}
        </Button>
      </div>
    </section>
  )
}

function Statement({ vault, onDeposit }: { vault: Vault; onDeposit: () => void }) {
  const { t } = useTranslation(['vaults', 'transactions', 'common'])
  const [searchParams, setSearchParams] = useSearchParams()
  const page = parsePage(searchParams.get('pagina'))
  const statement = useTransactions({ vaultId: vault.id, page, pageSize: PAGE_SIZE })

  function goToPage(next: number, replace = false) {
    setSearchParams(next > 1 ? { pagina: String(next) } : {}, { replace })
  }

  const data = statement.data
  const lastPage = data ? Math.max(1, Math.ceil(data.totalCount / data.pageSize)) : 1
  const isPastLastPage = data !== undefined && !statement.isPlaceholderData && page > lastPage
  useEffect(() => {
    if (isPastLastPage) goToPage(lastPage, true)
  })

  function renderContent() {
    if (statement.isError && !data) {
      return (
        <EmptyState
          role="alert"
          image="erro"
          title={t('detail.statementError')}
          description={statement.error.message}
          action={<Button variant="secondary" onClick={() => statement.refetch()}>{t('common:actions.tryAgain')}</Button>}
        />
      )
    }
    if (!data || isPastLastPage || (statement.isPlaceholderData && data.items.length === 0)) {
      return (
        <div className="flex justify-center py-12 text-primary" role="status">
          <Spinner className="size-8" />
          <span className="sr-only">{t('detail.statementLoading')}</span>
        </div>
      )
    }
    if (data.items.length === 0) {
      return (
        <EmptyState
          image="cofre-vazio"
          title={t('detail.statementEmptyTitle')}
          description={t('detail.statementEmptyDescription')}
          action={(
            <Button onClick={onDeposit}>
              <Icon name="income" className="size-4" />
              {t('common:actions.deposit')}
            </Button>
          )}
        />
      )
    }
    return (
      <>
        <div
          aria-busy={statement.isPlaceholderData || undefined}
          className={`transition-opacity ${statement.isPlaceholderData ? 'opacity-60' : ''}`}
        >
          <VaultStatement items={data.items} />
        </div>
        <Pagination
          page={page}
          lastPage={lastPage}
          itemsLabel={t('transactions:count', { count: data.totalCount })}
          onPageChange={(next) => goToPage(next)}
        />
      </>
    )
  }

  return (
    <section aria-labelledby="extrato" className="mt-4 overflow-hidden rounded-2xl border border-border bg-surface">
      <div className="border-b border-border px-4 py-4 sm:px-5">
        <h2 id="extrato" className="text-lg font-semibold text-foreground">{t('detail.statement')}</h2>
        <p className="mt-1 text-sm text-muted">
          {t('detail.statementNote')}
        </p>
      </div>
      {renderContent()}
    </section>
  )
}
