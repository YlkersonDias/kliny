import { useEffect, useState } from 'react'
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

const BACK_LINK = (
  <Link
    to="/cofres"
    className="inline-flex items-center gap-1 rounded text-sm font-semibold text-primary underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-primary"
  >
    <Icon name="chevronLeft" className="size-4" />
    Cofres
  </Link>
)

export default function VaultDetailPage() {
  const id = parseId(useParams().id)
  const vault = useVault(id ?? 0, { enabled: id !== null })
  const [dialog, setDialog] = useState<VaultDialog>(null)
  const navigate = useNavigate()
  usePageTitle(vault.data?.name ?? 'Cofre')

  const isNotFound = id === null || (vault.error instanceof ApiError && vault.error.status === 404)

  if (isNotFound) {
    return (
      <>
        {BACK_LINK}
        <div className="mt-4 rounded-2xl border border-border bg-surface">
          <EmptyState
            image="sem-resultados"
            title="Cofre não encontrado."
            description="Ele pode ter sido apagado, ou o endereço está errado."
            action={<Link to="/cofres" className="font-semibold text-primary underline-offset-2 hover:underline">Voltar para Cofres</Link>}
          />
        </div>
      </>
    )
  }

  if (vault.isError) {
    return (
      <>
        {BACK_LINK}
        <div className="mt-4 rounded-2xl border border-border bg-surface">
          <EmptyState
            role="alert"
            image="erro"
            title="Não foi possível carregar o cofre"
            description={vault.error.message}
            action={<Button variant="secondary" onClick={() => vault.refetch()}>Tentar novamente</Button>}
          />
        </div>
      </>
    )
  }

  if (vault.isPending) {
    return (
      <>
        {BACK_LINK}
        <div className="mt-4 flex justify-center rounded-2xl border border-border bg-surface py-16 text-primary" role="status">
          <Spinner className="size-8" />
          <span className="sr-only">Carregando cofre…</span>
        </div>
      </>
    )
  }

  return (
    <>
      {BACK_LINK}
      <VaultHeader vault={vault.data} onDialog={setDialog} />
      <Statement vault={vault.data} onDeposit={() => setDialog({ kind: 'operation', vault: vault.data, operation: 'deposit' })} />
      <VaultDialogs dialog={dialog} onChange={setDialog} onDeleted={() => navigate('/cofres', { replace: true })} />
    </>
  )
}

function VaultHeader({ vault, onDialog }: { vault: Vault; onDialog: (dialog: VaultDialog) => void }) {
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
              <p className="text-sm text-muted">Criado em {formatTimestampDate(vault.createdAt)}</p>
            </div>
          </div>
          <p className="mt-4 text-sm text-muted">Saldo</p>
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
              <p className="font-semibold text-foreground">Meta atingida!</p>
              <p className="text-sm text-muted">Você juntou {formatMoney(vault.goal!)} ou mais.</p>
            </div>
          </div>
        )}
      </div>

      <GoalProgress balance={vault.balance} goal={vault.goal} className="mt-5" />

      <div className="mt-6 flex flex-wrap gap-2">
        <Button onClick={() => onDialog({ kind: 'operation', vault, operation: 'deposit' })}>
          <Icon name="income" className="size-4" />
          Depositar
        </Button>
        <Button variant="secondary" onClick={() => onDialog({ kind: 'operation', vault, operation: 'withdraw' })}>
          <Icon name="expense" className="size-4" />
          Retirar
        </Button>
        <Button variant="secondary" onClick={() => onDialog({ kind: 'form', vault })}>
          <Icon name="edit" className="size-4" />
          Editar
        </Button>
        <Button variant="secondary" onClick={() => onDialog({ kind: 'delete', vault })}>
          <Icon name="trash" className="size-4" />
          Apagar
        </Button>
      </div>
    </section>
  )
}

function Statement({ vault, onDeposit }: { vault: Vault; onDeposit: () => void }) {
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
          title="Não foi possível carregar o extrato"
          description={statement.error.message}
          action={<Button variant="secondary" onClick={() => statement.refetch()}>Tentar novamente</Button>}
        />
      )
    }
    if (!data || isPastLastPage || (statement.isPlaceholderData && data.items.length === 0)) {
      return (
        <div className="flex justify-center py-12 text-primary" role="status">
          <Spinner className="size-8" />
          <span className="sr-only">Carregando extrato…</span>
        </div>
      )
    }
    if (data.items.length === 0) {
      return (
        <EmptyState
          image="cofre-vazio"
          title="Nenhuma movimentação neste cofre."
          description="Faça o primeiro depósito para começar a juntar."
          action={(
            <Button onClick={onDeposit}>
              <Icon name="income" className="size-4" />
              Depositar
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
          totalCount={data.totalCount}
          noun={['movimentação', 'movimentações']}
          onPageChange={(next) => goToPage(next)}
        />
      </>
    )
  }

  return (
    <section aria-labelledby="extrato" className="mt-4 overflow-hidden rounded-2xl border border-border bg-surface">
      <div className="border-b border-border px-4 py-4 sm:px-5">
        <h2 id="extrato" className="text-lg font-semibold text-foreground">Extrato</h2>
        <p className="mt-1 text-sm text-muted">
          Depósitos e retiradas não podem ser editados. Para corrigir, faça a operação inversa.
        </p>
      </div>
      {renderContent()}
    </section>
  )
}
