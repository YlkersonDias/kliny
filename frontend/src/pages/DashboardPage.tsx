import { useState } from 'react'
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
import { currentMonthRange, formatMonthYear, today as getToday } from '../lib/dates'

const RECENT_COUNT = 5
const STARTING_BALANCE: TransactionPreset = { kind: 'income', description: 'Saldo inicial' }

// Bloco cinza do tamanho do conteúdo, enquanto carrega (sem pular a tela).
function Placeholder({ className }: { className: string }) {
  return <div className={`rounded-2xl border border-border bg-surface motion-safe:animate-pulse ${className}`} />
}

export default function DashboardPage() {
  usePageTitle('Início')
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
          <span className="sr-only">Carregando…</span>
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
            title="Não foi possível carregar o resumo"
            description={recent.error.message}
            action={<Button variant="secondary" onClick={() => recent.refetch()}>Tentar novamente</Button>}
          />
        </div>
      )
    }
    if (recent.data.totalCount === 0) {
      return <WelcomeCard onStart={() => setForm({ preset: STARTING_BALANCE })} />
    }

    return (
      <div className="space-y-4">
        {monthSummary.isError || todaySummary.isError ? (
          <section className="space-y-3 rounded-2xl border border-border bg-surface p-5">
            <FormAlert>Não foi possível carregar o resumo do mês. {(monthSummary.error ?? todaySummary.error)?.message}</FormAlert>
            <Button
              variant="secondary"
              onClick={() => { void monthSummary.refetch(); void todaySummary.refetch() }}
            >
              Tentar novamente
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
                <FormAlert>Não foi possível carregar os gastos por dia. {timeline.error.message}</FormAlert>
                <Button variant="secondary" onClick={() => timeline.refetch()}>Tentar novamente</Button>
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
          {vaults.isError ? (
            <section className="space-y-3 rounded-2xl border border-border bg-surface p-5">
              <FormAlert>Não foi possível carregar os cofres. {vaults.error.message}</FormAlert>
              <Button variant="secondary" onClick={() => vaults.refetch()}>Tentar novamente</Button>
            </section>
          ) : vaults.data ? (
            <VaultsOverview vaults={vaults.data} />
          ) : (
            <Placeholder className="h-48" />
          )}
        </div>
      </div>
    )
  }

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold text-foreground">{formatMonthYear(today)}</h1>
        {recent.data && recent.data.totalCount > 0 && (
          <Button onClick={() => setForm({})}>
            <Icon name="plus" className="size-4" />
            Nova movimentação
          </Button>
        )}
      </div>
      <div className="mt-6">{renderContent()}</div>
      {form && <TransactionFormModal preset={form.preset} onClose={() => setForm(null)} />}
    </>
  )
}
