import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import type { Transaction } from '../../api/types'
import { formatDate } from '../../lib/dates'
import { TransactionAmount, TransactionCategory, TransactionKindIcon } from '../transactions/TransactionParts'

// Só leitura: editar e apagar ficam na tela de Movimentações.
export function RecentTransactions({ items }: { items: Transaction[] }) {
  const { t } = useTranslation('dashboard')
  return (
    <section aria-labelledby="ultimas" className="rounded-2xl border border-border bg-surface py-4">
      <div className="flex items-baseline justify-between gap-3 px-5 pb-2">
        <h2 id="ultimas" className="text-lg font-semibold text-foreground">{t('recent.title')}</h2>
        <Link to="/movimentacoes" className="rounded text-sm font-semibold text-primary underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-primary">
          {t('recent.seeAll')}
        </Link>
      </div>
      <ul className="divide-y divide-border">
        {items.map((transaction) => (
          <li key={transaction.id} className="flex items-center gap-3 px-5 py-3">
            <TransactionKindIcon transaction={transaction} />
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium text-foreground" title={transaction.description}>{transaction.description}</p>
              <p className="mt-0.5 truncate text-sm">
                <span className="text-muted tabular-nums">{formatDate(transaction.date)}</span>
                <span className="text-muted" aria-hidden="true"> · </span>
                <TransactionCategory transaction={transaction} />
              </p>
            </div>
            <TransactionAmount transaction={transaction} />
          </li>
        ))}
      </ul>
    </section>
  )
}
