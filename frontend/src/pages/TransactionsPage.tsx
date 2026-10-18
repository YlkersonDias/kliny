import { useEffect, useState } from 'react'
import { Trans, useTranslation } from 'react-i18next'
import { Link, useSearchParams } from 'react-router'
import type { Transaction } from '../api/types'
import { CategoryManagerModal } from '../components/transactions/CategoryManagerModal'
import { RecurrenceManagerModal } from '../components/transactions/RecurrenceManagerModal'
import { TransactionFiltersBar } from '../components/transactions/TransactionFiltersBar'
import { TransactionFormModal } from '../components/transactions/TransactionFormModal'
import { TransactionList } from '../components/transactions/TransactionList'
import { Button } from '../components/ui/Button'
import { buttonClass } from '../components/ui/buttonStyles'
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
  const { t } = useTranslation(['transactions', 'common'])
  usePageTitle(t('title'))
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
  const [managingRecurrences, setManagingRecurrences] = useState(false)

  // Trocar um filtro volta para a página 1; trocar de página entra no histórico.
  function updateFilters(patch: Partial<TransactionFilters>) {
    const next = { ...filters, page: 1, ...patch }
    setSearchParams(filtersToParams(next, month), { replace: patch.page === undefined })
  }

  function clearFilters() {
    setSearchParams(new URLSearchParams(), { replace: true })
  }

  // Página além da última (depois de apagar o último item, ou URL antiga): vai para a última.
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
      {t('newButton')}
    </Button>
  )

  function renderContent() {
    if (periodError) {
      return <p className="px-4 py-10 text-center text-sm text-muted">{t('adjustPeriod')}</p>
    }
    if (transactions.isError && !data) {
      return (
        <EmptyState
          role="alert"
          image="erro"
          title={t('loadError')}
          description={transactions.error.message}
          action={<Button variant="secondary" onClick={() => transactions.refetch()}>{t('common:actions.tryAgain')}</Button>}
        />
      )
    }
    // Lista vazia do filtro anterior não serve de prévia: o texto do vazio seria do filtro novo.
    if (!data || isPastLastPage || (transactions.isPlaceholderData && data.items.length === 0)) {
      return (
        <div className="flex justify-center py-16 text-primary" role="status">
          <Spinner className="size-8" />
          <span className="sr-only">{t('loading')}</span>
        </div>
      )
    }
    if (data.items.length === 0) {
      if (hasOtherFilters(filters)) {
        return (
          <EmptyState
            image="sem-resultados"
            title={t('empty.filteredTitle')}
            description={filters.search.trim()
              // O texto digitado entra como elemento pronto, nunca pelo parser de tags.
              ? <Trans t={t} i18nKey="empty.searchDescription" components={{ search: <strong className="font-semibold text-foreground">{filters.search.trim()}</strong> }} />
              : t('empty.filteredDescription')}
            action={<Button variant="secondary" onClick={clearFilters}>{t('empty.clearFilters')}</Button>}
          />
        )
      }
      const isMonth = isDefaultPeriod(filters, month)
      return (
        <EmptyState
          image="cofre-vazio"
          title={isMonth ? t('empty.monthTitle') : t('empty.periodTitle')}
          description={isMonth ? t('empty.monthDescription') : t('empty.periodDescription')}
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
          itemsLabel={t('count', { count: data.totalCount })}
          onPageChange={(page) => updateFilters({ page })}
        />
      </>
    )
  }

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold text-foreground">{t('title')}</h1>
        <div className="flex flex-wrap gap-2">
          <Link to="/movimentacoes/importar" className={buttonClass('secondary')}>
            <Icon name="expense" className="size-4" />
            {t('importButton')}
          </Link>
          <Button variant="secondary" onClick={() => setManagingRecurrences(true)}>
            <Icon name="repeat" className="size-4" />
            {t('recurring.manage')}
          </Button>
          <Button variant="secondary" onClick={() => setManagingCategories(true)}>
            <Icon name="tag" className="size-4" />
            {t('manageCategories')}
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
        <section aria-label={t('listLabel')} className="overflow-hidden rounded-2xl border border-border bg-surface">
          {renderContent()}
        </section>
      </div>

      {form && <TransactionFormModal transaction={form.transaction} onClose={() => setForm(null)} />}
      {deleting && <DeleteTransactionDialog transaction={deleting} onClose={() => setDeleting(null)} />}
      {managingRecurrences && <RecurrenceManagerModal onClose={() => setManagingRecurrences(false)} />}
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
  const { t } = useTranslation('transactions')
  const mutation = useDeleteTransaction()

  return (
    <ConfirmDialog
      title={t('delete.title')}
      confirmLabel={t('delete.confirm')}
      isLoading={mutation.isPending}
      error={mutation.error?.message}
      onCancel={onClose}
      onConfirm={() => mutation.mutate(transaction.id, { onSuccess: onClose })}
    >
      <p>
        {/* <name/> recebe o elemento pronto: a descrição digitada nunca passa pelo parser de tags. */}
        <Trans
          t={t}
          i18nKey="delete.question"
          values={{ date: formatDate(transaction.date) }}
          components={{ name: <strong className="font-semibold text-foreground">{transaction.description}</strong> }}
        />
      </p>
      <p className="mt-2">{t('delete.irreversible')}</p>
    </ConfirmDialog>
  )
}
