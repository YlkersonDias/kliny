import { useSearchParams } from 'react-router'
import type { CategoryReportType, ReportPeriod, TimelineGrouping } from '../api/types'
import { CategorySection } from '../components/reports/CategorySection'
import { PeriodSelector } from '../components/reports/PeriodSelector'
import { ReportSummary } from '../components/reports/ReportSummary'
import { TimelineSection } from '../components/reports/TimelineSection'
import { Button } from '../components/ui/Button'
import { EmptyState } from '../components/ui/EmptyState'
import { FormAlert } from '../components/ui/FormAlert'
import { usePageTitle } from '../hooks/usePageTitle'
import { useCategoryReport, useSummary, useTimeline } from '../hooks/useReports'
import { formatDate } from '../lib/dates'
import {
  parseReportFilters, periodError as getPeriodError, presetRange, reportFiltersToParams, resolveGrouping,
  type PeriodPreset, type ReportFilters,
} from '../lib/reportPeriods'

function Placeholder({ className }: { className: string }) {
  return <div className={`rounded-2xl border border-border bg-surface motion-safe:animate-pulse ${className}`} />
}

function SectionError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <section className="space-y-3 rounded-2xl border border-border bg-surface p-5">
      <FormAlert>{message}</FormAlert>
      <Button variant="secondary" onClick={onRetry}>Tentar novamente</Button>
    </section>
  )
}

export default function ReportsPage() {
  usePageTitle('Relatórios')
  const [searchParams, setSearchParams] = useSearchParams()
  const filters = parseReportFilters(searchParams)
  const { period } = filters
  const periodError = getPeriodError(period)
  // Com o período inválido, nada é consultado (a API recusaria).
  const enabled = !periodError
  const { grouping, dayAllowed } = enabled
    ? resolveGrouping(period, filters.grouping)
    : { grouping: filters.grouping ?? 'month', dayAllowed: true }

  const options = { enabled, keepPrevious: true }
  const summary = useSummary(period, options)
  const categories = useCategoryReport(period, filters.type, options)
  const timeline = useTimeline(period, grouping, options)

  // Trocar filtros não enche o histórico do navegador.
  function update(patch: Partial<ReportFilters>) {
    setSearchParams(reportFiltersToParams({ ...filters, ...patch }), { replace: true })
  }

  function changePreset(preset: PeriodPreset) {
    // Ao entrar em "Personalizado", começa do período que estava na tela.
    update(preset === 'personalizado' ? { preset, period } : { preset, period: presetRange(preset) })
  }

  function renderContent() {
    if (periodError) {
      return <p className="rounded-2xl border border-border bg-surface px-5 py-8 text-center text-sm text-muted">Ajuste o período para ver os relatórios.</p>
    }
    if (summary.isError && !summary.data) {
      return (
        <div className="rounded-2xl border border-border bg-surface">
          <EmptyState
            role="alert"
            image="erro"
            title="Não foi possível carregar os relatórios"
            description={summary.error.message}
            action={<Button variant="secondary" onClick={() => summary.refetch()}>Tentar novamente</Button>}
          />
        </div>
      )
    }
    if (!summary.data) {
      return (
        <div role="status" className="space-y-4">
          <span className="sr-only">Carregando relatórios…</span>
          <Placeholder className="h-56" />
          <Placeholder className="h-80" />
          <Placeholder className="h-72" />
        </div>
      )
    }

    const s = summary.data
    // Prévia vazia do período anterior não serve: o vazio seria do período errado.
    const isEmpty = s.income === 0 && s.expense === 0 && s.vaultDeposits === 0 && s.vaultWithdrawals === 0
    if (isEmpty && summary.isPlaceholderData) return <Placeholder className="h-72" />
    if (isEmpty) {
      return (
        <div className="rounded-2xl border border-border bg-surface">
          <EmptyState
            image="sem-dados"
            title="Nenhuma movimentação neste período."
            description={`De ${formatDate(period.from)} a ${formatDate(period.to)} não há receitas, gastos nem operações de cofre. Escolha outro período.`}
          />
        </div>
      )
    }

    return (
      <div className="space-y-4">
        <div aria-busy={summary.isPlaceholderData || undefined} className={`transition-opacity ${summary.isPlaceholderData ? 'opacity-60' : ''}`}>
          <ReportSummary summary={s} />
        </div>

        {categories.isError && !categories.data ? (
          <SectionError message={`Não foi possível carregar o relatório por categoria. ${categories.error.message}`} onRetry={() => categories.refetch()} />
        ) : categories.data ? (
          <CategorySection
            type={filters.type}
            rows={categories.data}
            onTypeChange={(type: CategoryReportType) => update({ type })}
            isRefreshing={categories.isPlaceholderData}
          />
        ) : (
          <Placeholder className="h-80" />
        )}

        {timeline.isError && !timeline.data ? (
          <SectionError message={`Não foi possível carregar a linha do tempo. ${timeline.error.message}`} onRetry={() => timeline.refetch()} />
        ) : timeline.data ? (
          <TimelineSection points={timeline.data} grouping={grouping} isRefreshing={timeline.isPlaceholderData} />
        ) : (
          <Placeholder className="h-72" />
        )}
      </div>
    )
  }

  return (
    <>
      <h1 className="text-2xl font-semibold text-foreground">Relatórios</h1>
      <p className="mt-1 text-sm text-muted">
        {formatDate(period.from)} a {formatDate(period.to)} · operações de cofre ficam fora de receitas e gastos.
      </p>
      <div className="mt-6 space-y-4">
        <PeriodSelector
          preset={filters.preset}
          period={period}
          periodError={periodError}
          grouping={grouping}
          dayAllowed={dayAllowed}
          onPresetChange={changePreset}
          onPeriodChange={(next: ReportPeriod) => update({ preset: 'personalizado', period: next })}
          onGroupingChange={(next: TimelineGrouping) => update({ grouping: next })}
        />
        {renderContent()}
      </div>
    </>
  )
}
