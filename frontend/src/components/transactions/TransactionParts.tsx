import { useTranslation } from 'react-i18next'
import type { Transaction } from '../../api/types'
import { useCategories } from '../../hooks/useCategories'
import { formatSigned } from '../../lib/money'
import { CategoryIcon } from '../ui/CategoryIcon'
import { Icon } from '../ui/Icon'

// Do ponto de vista da conta (sinal do banco).

type Kind = 'income' | 'expense' | 'vault'

function kindOf(transaction: Transaction): Kind {
  if (transaction.vaultId !== null) return 'vault'
  return transaction.amount > 0 ? 'income' : 'expense'
}

const KIND = {
  income: { text: 'text-income', icon: 'text-income' },
  expense: { text: 'text-expense', icon: 'text-expense' },
  // Âmbar só no ícone: no texto, não tem contraste.
  vault: { text: 'text-vault-text', icon: 'text-vault' },
} as const

// Sempre com sinal e ícone: receita e gasto não dependem só da cor.
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

// O "(n/N)" já está na descrição.
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
  const categories = useCategories()
  if (transaction.vaultId !== null) return <span className="text-vault-text">{t('kind.vault')}</span>
  if (transaction.categoryName === null) return <span className="text-muted">{t('common:uncategorized')}</span>
  const category = categories.data?.find((item) => item.id === transaction.categoryId)
  return (
    <span className="inline-flex max-w-full items-center gap-1.5 align-middle text-foreground">
      <CategoryIcon category={category} size="size-5" />
      <span className="min-w-0 truncate">{transaction.categoryName}</span>
    </span>
  )
}
