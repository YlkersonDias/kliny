import { useTranslation } from 'react-i18next'
import type { Transaction } from '../../api/types'
import { formatSigned } from '../../lib/money'
import { Icon } from '../ui/Icon'

// Peças de uma linha de movimentação, do ponto de vista da conta (sinal do banco).
// Usadas na tela de Movimentações e no Dashboard.

type Kind = 'income' | 'expense' | 'vault'

function kindOf(transaction: Transaction): Kind {
  if (transaction.vaultId !== null) return 'vault'
  return transaction.amount > 0 ? 'income' : 'expense'
}

const KIND = {
  income: { text: 'text-income', icon: 'text-income' },
  expense: { text: 'text-expense', icon: 'text-expense' },
  // Âmbar só no ícone; o texto usa vault-text, que tem contraste.
  vault: { text: 'text-vault-text', icon: 'text-vault' },
} as const

// Valor sempre com sinal e ícone: receita e gasto não dependem só da cor.
export function TransactionAmount({ transaction }: { transaction: Transaction }) {
  const { t } = useTranslation('transactions')
  const kind = kindOf(transaction)
  return (
    <span className={`font-semibold tabular-nums whitespace-nowrap ${KIND[kind].text}`}>
      <span className="sr-only">{t('amountKind', { kind: t(`kind.${kind}`) })}{' '}</span>
      {formatSigned(transaction.amount)}
    </span>
  )
}

export function TransactionKindIcon({ transaction }: { transaction: Transaction }) {
  const kind = kindOf(transaction)
  return (
    <span className={`flex size-9 shrink-0 items-center justify-center rounded-full bg-background ${KIND[kind].icon}`}>
      <Icon name={kind} className="size-5" />
    </span>
  )
}

// Gerada por um lançamento recorrente (8.5a): ícone com o texto para o leitor de tela e a dica.
export function RecurringMark({ transaction }: { transaction: Transaction }) {
  const { t } = useTranslation('transactions')
  if (transaction.recurrenceId === null) return null
  return (
    <span className="inline-flex shrink-0 text-muted" title={t('recurring.badge')}>
      <Icon name="repeat" className="size-4" />
      <span className="sr-only">{t('recurring.badge')}</span>
    </span>
  )
}

// Parcela de uma compra parcelada (8.5b); o "(n/N)" já está na descrição.
export function InstallmentMark({ transaction }: { transaction: Transaction }) {
  const { t } = useTranslation('transactions')
  if (transaction.installmentPlanId === null) return null
  return (
    <span className="inline-flex shrink-0 text-muted" title={t('installments.badge')}>
      <Icon name="card" className="size-4" />
      <span className="sr-only">{t('installments.badge')}</span>
    </span>
  )
}

export function TransactionCategory({ transaction }: { transaction: Transaction }) {
  const { t } = useTranslation(['transactions', 'common'])
  if (transaction.vaultId !== null) return <span className="text-vault-text">{t('kind.vault')}</span>
  if (transaction.categoryName === null) return <span className="text-muted">{t('common:uncategorized')}</span>
  return <span className="text-foreground">{transaction.categoryName}</span>
}
