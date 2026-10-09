import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { BudgetsOverview } from '../components/dashboard/BudgetsOverview'
import { MonthSummaryCard } from '../components/dashboard/MonthSummaryCard'
import { RecentTransactions } from '../components/dashboard/RecentTransactions'
import { SpendingSection } from '../components/dashboard/SpendingSection'
import { VaultsOverview } from '../components/dashboard/VaultsOverview'
import { WelcomeCard } from '../components/dashboard/WelcomeCard'
import { TransactionFormModal, type TransactionPreset } from '../components/transactions/TransactionFormModal'
import { Button } from '../components/ui/Button'
import { EmptyState } from '../components/ui/EmptyState'
import { FormAlert } from '../components/ui/FormAlert'
import { Icon } from '../components/ui/Icon'
import { usePageTitle } from '../hooks/usePageTitle'
import { useSummary, useTimeline } from '../hooks/useReports'
import { useTransactions } from '../hooks/useTransactions'
import { useVaults } from '../hooks/useVaults'
import { budgetMonth } from '../lib/budgets'
import { currentMonthRange, formatLongDate, today as getToday } from '../lib/dates'

const RECENT_COUNT = 5

// Bloco cinza do tamanho do conteúdo, enquanto carrega (sem pular a tela).
function Placeholder({ className }: { className: string }) {
  return <div className={`rounded-2xl border border-border bg-surface motion-safe:animate-pulse ${className}`} />
}

export default function DashboardPage() {
  const { t } = useTranslation(['dashboard', 'transactions', 'common'])
  usePageTitle(t('title'))
  // Período calculado no navegador (data local); a API não escolhe período.
  const month = currentMonthRange()
  const today = getToday()

  const recent = useTransactions({ pageSize: RECENT_COUNT })
  const monthSummary = useSummary(month)
  const todaySummary = useSummary({ from: today, to: today })
  const timeline = useTimeline(month, 'day')
  const vaults = useVaults()
  const [form, setForm] = useState<{ preset?: TransactionPreset } | null>(null)

  function renderContent() {
    // Sem a lista não dá para saber se a conta é nova.
    if (recent.isPending) {
      return (
        <div role="status" className="space-y-4">
          <span className="sr-only">{t('common:loading')}</span>
          <Placeholder className="h-80" />
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
            <Placeholder className="h-72" />
            <Placeholder className="h-72" />
          </div>
        </div>
      )
    }
    if (recent.isError) {
      return (
        <div className="rounded-2xl border border-border bg-surface">
          <EmptyState
            role="alert"
            image="erro"
            title={t('loadError')}
            description={recent.error.message}
            action={<Button variant="secondary" onClick={() => recent.refetch()}>{t('common:actions.tryAgain')}</Button>}
          />
        </div>
      )
    }
    if (recent.data.totalCount === 0) {
      return <WelcomeCard onStart={() => setForm({ preset: { kind: 'income', description: t('startingBalance') } })} />
    }

    return (
      <div className="space-y-4">
        {monthSummary.isError || todaySummary.isError ? (
          <section className="space-y-3 rounded-2xl border border-border bg-surface p-5">
            <FormAlert>{t('summaryError', { message: (monthSummary.error ?? todaySummary.error)?.message ?? '' })}</FormAlert>
            <Button
              variant="secondary"
              onClick={() => { void monthSummary.refetch(); void todaySummary.refetch() }}
            >
              {t('common:actions.tryAgain')}
            </Button>
          </section>
        ) : !monthSummary.data || !todaySummary.data ? (
          <Placeholder className="h-80" />
        ) : (
          <MonthSummaryCard
            month={month}
            today={today}
            monthSummary={monthSummary.data}
            todaySummary={todaySummary.data}
            points={timeline.data ?? []}
            vaultCount={vaults.data?.length}
          >
            {timeline.isError ? (
              <div className="space-y-3">
                <FormAlert>{t('chartError', { message: timeline.error.message })}</FormAlert>
                <Button variant="secondary" onClick={() => timeline.refetch()}>{t('common:actions.tryAgain')}</Button>
              </div>
            ) : timeline.data ? (
              <SpendingSection points={timeline.data} today={today} />
            ) : (
              <div className="h-44 rounded-lg bg-background motion-safe:animate-pulse" />
            )}
          </MonthSummaryCard>
        )}

        <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
          <RecentTransactions items={recent.data.items} />
          <div className="space-y-4">
            {vaults.isError ? (
              <section className="space-y-3 rounded-2xl border border-border bg-surface p-5">
                <FormAlert>{t('vaultsError', { message: vaults.error.message })}</FormAlert>
                <Button variant="secondary" onClick={() => vaults.refetch()}>{t('common:actions.tryAgain')}</Button>
              </section>
            ) : vaults.data ? (
              <VaultsOverview vaults={vaults.data} />
            ) : (
              <Placeholder className="h-48" />
            )}
            <BudgetsOverview month={budgetMonth(month)} />
          </div>
        </div>
      </div>
    )
  }

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* A data de hoje (o cartão é sobre hoje; o mês aparece em "Este mês"). */}
        <h1 className="text-2xl font-semibold text-foreground">{formatLongDate(today)}</h1>
        {recent.data && recent.data.totalCount > 0 && (
          <Button onClick={() => setForm({})}>
            <Icon name="plus" className="size-4" />
            {t('transactions:newButton')}
          </Button>
        )}
      </div>
      <div className="mt-6">{renderContent()}</div>
      {form && <TransactionFormModal preset={form.preset} onClose={() => setForm(null)} />}
    </>
  )
}
