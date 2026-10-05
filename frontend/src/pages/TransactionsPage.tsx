import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router'
import type { Transaction } from '../api/types'
import { CategoryManagerModal } from '../components/transactions/CategoryManagerModal'
import { TransactionFiltersBar } from '../components/transactions/TransactionFiltersBar'
import { TransactionFormModal } from '../components/transactions/TransactionFormModal'
import { TransactionList } from '../components/transactions/TransactionList'
import { Button } from '../components/ui/Button'
import { ConfirmDialog } from '../components/ui/ConfirmDialog'
import { EmptyState } from '../components/ui/EmptyState'
import { Icon } from '../components/ui/Icon'
import { Pagination } from '../components/ui/Pagination'
import { Spinner } from '../components/ui/Spinner'
import { useCategories } from '../hooks/useCategories'
import { usePageTitle } from '../hooks/usePageTitle'
import { useDeleteTransaction, useTransactions } from '../hooks/useTransactions'
import { currentMonthRange, formatDate } from '../lib/dates'
import {
  filtersToParams, hasOtherFilters, isDefaultPeriod, parseFilters, rangeError, toQuery,
  type TransactionFilters,
} from '../lib/transactionFilters'

export default function TransactionsPage() {
  usePageTitle('Movimentações')
  const [searchParams, setSearchParams] = useSearchParams()
  const month = currentMonthRange()
  const categories = useCategories()

  let filters = parseFilters(searchParams, month)
  // Categoria que não existe mais (apagada, ou URL antiga) conta como "Todas".
  if (categories.data && /^\d+$/.test(filters.category)
    && !categories.data.some((category) => String(category.id) === filters.category)) {
    filters = { ...filters, category: '' }
  }
  const periodError = rangeError(filters)
  const transactions = useTransactions(toQuery(filters), { enabled: !periodError })

  const [form, setForm] = useState<{ transaction?: Transaction } | null>(null)
  const [deleting, setDeleting] = useState<Transaction | null>(null)
  const [managingCategories, setManagingCategories] = useState(false)

  // Trocar um filtro volta para a página 1; trocar de página entra no histórico.
  function updateFilters(patch: Partial<TransactionFilters>) {
    const next = { ...filters, page: 1, ...patch }
    setSearchParams(filtersToParams(next, month), { replace: patch.page === undefined })
  }

  function clearFilters() {
    setSearchParams(new URLSearchParams(), { replace: true })
  }

  // Página além da última (depois de apagar o último item dela, ou URL antiga): vai para a última.
  const data = transactions.data
  const lastPage = data ? Math.max(1, Math.ceil(data.totalCount / data.pageSize)) : 1
  const isPastLastPage = data !== undefined && !transactions.isPlaceholderData && filters.page > lastPage
  useEffect(() => {
    if (isPastLastPage) setSearchParams(filtersToParams({ ...filters, page: lastPage }, month), { replace: true })
  })

  const canClear = hasOtherFilters(filters) || !isDefaultPeriod(filters, month)
  const newButton = (
    <Button onClick={() => setForm({})}>
      <Icon name="plus" className="size-4" />
      Nova movimentação
    </Button>
  )

  function renderContent() {
    if (periodError) {
      return <p className="px-4 py-10 text-center text-sm text-muted">Ajuste o período para ver as movimentações.</p>
    }
    if (transactions.isError && !data) {
      return (
        <EmptyState
          role="alert"
          image="erro"
          title="Não foi possível carregar as movimentações"
          description={transactions.error.message}
          action={<Button variant="secondary" onClick={() => transactions.refetch()}>Tentar novamente</Button>}
        />
      )
    }
    // Lista vazia do filtro anterior não serve de prévia: o texto do vazio seria do filtro novo.
    if (!data || isPastLastPage || (transactions.isPlaceholderData && data.items.length === 0)) {
      return (
        <div className="flex justify-center py-16 text-primary" role="status">
          <Spinner className="size-8" />
          <span className="sr-only">Carregando movimentações…</span>
        </div>
      )
    }
    if (data.items.length === 0) {
      if (hasOtherFilters(filters)) {
        return (
          <EmptyState
            image="sem-resultados"
            title="Nenhuma movimentação encontrada com esses filtros."
            description="Tente outra categoria, outro tipo ou outro período."
            action={<Button variant="secondary" onClick={clearFilters}>Limpar filtros</Button>}
          />
        )
      }
      const isMonth = isDefaultPeriod(filters, month)
      return (
        <EmptyState
          image="cofre-vazio"
          title={isMonth ? 'Nenhuma movimentação neste mês.' : 'Nenhuma movimentação no período.'}
          description={isMonth ? 'Lance uma receita ou um gasto para começar.' : 'Escolha outro período ou lance uma nova movimentação.'}
          action={newButton}
        />
      )
    }

    return (
      <>
        <div
          aria-busy={transactions.isPlaceholderData || undefined}
          className={`transition-opacity ${transactions.isPlaceholderData ? 'opacity-60' : ''}`}
        >
          <TransactionList items={data.items} onEdit={(transaction) => setForm({ transaction })} onDelete={setDeleting} />
        </div>
        <Pagination
          page={filters.page}
          lastPage={lastPage}
          totalCount={data.totalCount}
          noun={['movimentação', 'movimentações']}
          onPageChange={(page) => updateFilters({ page })}
        />
      </>
    )
  }

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold text-foreground">Movimentações</h1>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={() => setManagingCategories(true)}>
            <Icon name="tag" className="size-4" />
            Gerenciar categorias
          </Button>
          {newButton}
        </div>
      </div>

      <div className="mt-6 space-y-4">
        <TransactionFiltersBar
          filters={filters}
          categories={categories.data ?? []}
          rangeError={periodError}
          canClear={canClear}
          onChange={updateFilters}
          onClear={clearFilters}
        />
        <section aria-label="Lista de movimentações" className="overflow-hidden rounded-2xl border border-border bg-surface">
          {renderContent()}
        </section>
      </div>

      {form && <TransactionFormModal transaction={form.transaction} onClose={() => setForm(null)} />}
      {deleting && <DeleteTransactionDialog transaction={deleting} onClose={() => setDeleting(null)} />}
      {managingCategories && (
        <CategoryManagerModal
          onClose={() => setManagingCategories(false)}
          onDeleted={(id) => { if (filters.category === String(id)) updateFilters({ category: '' }) }}
        />
      )}
    </>
  )
}

function DeleteTransactionDialog({ transaction, onClose }: { transaction: Transaction; onClose: () => void }) {
  const mutation = useDeleteTransaction()

  return (
    <ConfirmDialog
      title="Apagar movimentação"
      confirmLabel="Apagar"
      isLoading={mutation.isPending}
      error={mutation.error?.message}
      onCancel={onClose}
      onConfirm={() => mutation.mutate(transaction.id, { onSuccess: onClose })}
    >
      <p>
        Apagar <strong className="font-semibold text-foreground">{transaction.description}</strong> de{' '}
        {formatDate(transaction.date)}?
      </p>
      <p className="mt-2">Essa ação não pode ser desfeita.</p>
    </ConfirmDialog>
  )
}
