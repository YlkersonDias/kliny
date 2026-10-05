import type { ReactNode } from 'react'
import type { ReportPeriod, SummaryResponse, TimelinePoint } from '../../api/types'
import { hasFutureEntries } from '../../lib/dashboard'
import { formatDate } from '../../lib/dates'
import { formatMoney, formatOutflow, formatSigned } from '../../lib/money'
import { Icon } from '../ui/Icon'
import { StatItem } from '../ui/StatItem'

interface MonthSummaryCardProps {
  month: ReportPeriod
  today: string
  // Movimento do mês inteiro (inclui lançamentos com data depois de hoje).
  monthSummary: SummaryResponse
  // Saldos de hoje: "Na conta" não conta o que ainda não aconteceu.
  todaySummary: SummaryResponse
  // Para saber se há receita ou gasto com data futura; vazio enquanto a timeline carrega.
  points: TimelinePoint[]
  vaultCount?: number
  children?: ReactNode
}

// Saldo negativo com o "−" tipográfico, igual aos outros valores.
function formatBalance(value: number): string {
  return value < 0 ? formatSigned(value) : formatMoney(value)
}

export function MonthSummaryCard({
  month, today, monthSummary, todaySummary, points, vaultCount, children,
}: MonthSummaryCardProps) {
  const showFutureNote = hasFutureEntries(points, today, monthSummary, todaySummary)
  const vaultsText = vaultCount === undefined
    ? 'em cofres'
    : `em ${vaultCount} ${vaultCount === 1 ? 'cofre' : 'cofres'}`

  return (
    <section aria-labelledby="na-conta" className="rounded-2xl border border-border bg-surface p-5 sm:p-7">
      <p id="na-conta" className="text-sm text-muted">Na conta hoje</p>
      <p className="mt-1 text-4xl font-semibold tracking-tight tabular-nums wrap-anywhere text-foreground sm:text-5xl">
        {formatBalance(todaySummary.accountBalance)}
      </p>
      {(todaySummary.vaultsBalance !== 0 || (vaultCount ?? 0) > 0) && (
        <p className="mt-2 flex flex-wrap items-center gap-2 text-sm text-muted">
          {/* Âmbar só no ícone. */}
          <Icon name="vault" className="size-4 text-vault" />
          <span>
            e <strong className="font-semibold tabular-nums text-foreground">{formatMoney(todaySummary.vaultsBalance)}</strong>{' '}
            guardados {vaultsText}
          </span>
        </p>
      )}

      <div className="my-6 h-px bg-border" />

      <h2 className="text-lg font-semibold text-foreground">Este mês</h2>
      {/* Convenção dos relatórios: expense já vem positivo; formatOutflow só põe o "−". */}
      <dl className="mt-3 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <StatItem label="Entrou" value={formatSigned(monthSummary.income)} valueClass="text-income" icon={{ name: 'income', className: 'text-income' }} />
        <StatItem label="Saiu" value={formatOutflow(monthSummary.expense)} valueClass="text-expense" icon={{ name: 'expense', className: 'text-expense' }} />
        <StatItem label="Sobrou" value={formatSigned(monthSummary.net)} className="sm:pl-2" />
      </dl>
      {showFutureNote && (
        <p className="mt-3 text-sm text-muted">
          Este mês inclui lançamentos com data depois de hoje. Eles já entram em “Entrou” e “Saiu”,
          mas só contam em “Na conta” quando a data chegar: em {formatDate(month.to).slice(0, 5)}, o saldo
          previsto é {formatBalance(monthSummary.accountBalance)}.
        </p>
      )}

      {children && <div className="mt-6">{children}</div>}
    </section>
  )
}
