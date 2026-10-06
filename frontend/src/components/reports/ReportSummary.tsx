import { useTranslation } from 'react-i18next'
import type { SummaryResponse } from '../../api/types'
import { formatDate } from '../../lib/dates'
import { formatMoney, formatOutflow, formatSigned } from '../../lib/money'
import { StatItem } from '../ui/StatItem'

function formatBalance(value: number): string {
  return value < 0 ? formatSigned(value) : formatMoney(value)
}

// Convenção dos relatórios: expense e vaultDeposits vêm positivos; formatOutflow só põe o "−".
export function ReportSummary({ summary }: { summary: SummaryResponse }) {
  const { t } = useTranslation('reports')
  return (
    <section aria-labelledby="resumo-periodo" className="rounded-2xl border border-border bg-surface p-5 sm:p-6">
      <h2 id="resumo-periodo" className="text-lg font-semibold text-foreground">{t('summary.title')}</h2>
      <dl className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <StatItem label={t('summary.in')} value={formatSigned(summary.income)} valueClass="text-income" icon={{ name: 'income', className: 'text-income' }} />
        <StatItem label={t('summary.out')} value={formatOutflow(summary.expense)} valueClass="text-expense" icon={{ name: 'expense', className: 'text-expense' }} />
        <StatItem label={t('summary.left')} value={formatSigned(summary.net)} />
      </dl>
      <div className="my-5 h-px bg-border" />
      <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatItem label={t('summary.vaultDeposits')} value={formatMoney(summary.vaultDeposits)} valueClass="text-vault-text" icon={{ name: 'vault', className: 'text-vault' }} />
        <StatItem label={t('summary.vaultWithdrawals')} value={formatMoney(summary.vaultWithdrawals)} valueClass="text-vault-text" />
        <StatItem label={t('summary.accountBalance', { date: formatDate(summary.to) })} value={formatBalance(summary.accountBalance)} />
        <StatItem label={t('summary.vaultsBalance', { date: formatDate(summary.to) })} value={formatMoney(summary.vaultsBalance)} />
      </dl>
    </section>
  )
}
