import type { SummaryResponse } from '../../api/types'
import { formatDate } from '../../lib/dates'
import { formatMoney, formatOutflow, formatSigned } from '../../lib/money'
import { StatItem } from '../ui/StatItem'

function formatBalance(value: number): string {
  return value < 0 ? formatSigned(value) : formatMoney(value)
}

// Convenção dos relatórios: expense e vaultDeposits vêm positivos; formatOutflow só põe o "−".
export function ReportSummary({ summary }: { summary: SummaryResponse }) {
  return (
    <section aria-labelledby="resumo-periodo" className="rounded-2xl border border-border bg-surface p-5 sm:p-6">
      <h2 id="resumo-periodo" className="text-lg font-semibold text-foreground">Resumo do período</h2>
      <dl className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <StatItem label="Entrou" value={formatSigned(summary.income)} valueClass="text-income" icon={{ name: 'income', className: 'text-income' }} />
        <StatItem label="Saiu" value={formatOutflow(summary.expense)} valueClass="text-expense" icon={{ name: 'expense', className: 'text-expense' }} />
        <StatItem label="Sobrou" value={formatSigned(summary.net)} />
      </dl>
      <div className="my-5 h-px bg-border" />
      <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatItem label="Depósitos em cofres" value={formatMoney(summary.vaultDeposits)} valueClass="text-vault-text" icon={{ name: 'vault', className: 'text-vault' }} />
        <StatItem label="Retiradas de cofres" value={formatMoney(summary.vaultWithdrawals)} valueClass="text-vault-text" />
        <StatItem label={`Saldo da conta em ${formatDate(summary.to)}`} value={formatBalance(summary.accountBalance)} />
        <StatItem label={`Guardado em cofres em ${formatDate(summary.to)}`} value={formatMoney(summary.vaultsBalance)} />
      </dl>
    </section>
  )
}
