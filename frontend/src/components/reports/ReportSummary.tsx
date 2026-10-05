import type { ReactNode } from 'react'
import type { SummaryResponse } from '../../api/types'
import { formatDate } from '../../lib/dates'
import { formatMoney, formatOutflow, formatSigned } from '../../lib/money'
import { Icon } from '../ui/Icon'

// Convenção dos relatórios: expense e vaultDeposits vêm positivos; formatOutflow só põe o "−".
function Stat({ label, value, valueClass = 'text-foreground', icon }: {
  label: string
  value: string
  valueClass?: string
  icon?: ReactNode
}) {
  return (
    <div className="flex items-center gap-3">
      {icon}
      <div className="min-w-0">
        <dt className="text-sm text-muted">{label}</dt>
        <dd className={`text-xl font-semibold tabular-nums ${valueClass}`}>{value}</dd>
      </div>
    </div>
  )
}

function Bubble({ name, className }: { name: 'income' | 'expense' | 'vault'; className: string }) {
  return (
    <span className={`flex size-9 shrink-0 items-center justify-center rounded-full bg-background ${className}`}>
      <Icon name={name} className="size-5" />
    </span>
  )
}

function formatBalance(value: number): string {
  return value < 0 ? formatSigned(value) : formatMoney(value)
}

export function ReportSummary({ summary }: { summary: SummaryResponse }) {
  return (
    <section aria-labelledby="resumo-periodo" className="rounded-2xl border border-border bg-surface p-5 sm:p-6">
      <h2 id="resumo-periodo" className="text-lg font-semibold text-foreground">Resumo do período</h2>
      <dl className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Stat label="Entrou" value={formatSigned(summary.income)} valueClass="text-income" icon={<Bubble name="income" className="text-income" />} />
        <Stat label="Saiu" value={formatOutflow(summary.expense)} valueClass="text-expense" icon={<Bubble name="expense" className="text-expense" />} />
        <Stat label="Sobrou" value={formatSigned(summary.net)} />
      </dl>
      <div className="my-5 h-px bg-border" />
      <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Depósitos em cofres" value={formatMoney(summary.vaultDeposits)} valueClass="text-vault-text" icon={<Bubble name="vault" className="text-vault" />} />
        <Stat label="Retiradas de cofres" value={formatMoney(summary.vaultWithdrawals)} valueClass="text-vault-text" />
        <Stat label={`Saldo da conta em ${formatDate(summary.to)}`} value={formatBalance(summary.accountBalance)} />
        <Stat label={`Guardado em cofres em ${formatDate(summary.to)}`} value={formatMoney(summary.vaultsBalance)} />
      </dl>
    </section>
  )
}
