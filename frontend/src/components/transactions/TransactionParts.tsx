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
  income: { label: 'Receita', text: 'text-income', icon: 'text-income' },
  expense: { label: 'Gasto', text: 'text-expense', icon: 'text-expense' },
  // Âmbar só no ícone; o texto usa vault-text, que tem contraste.
  vault: { label: 'Cofre', text: 'text-vault-text', icon: 'text-vault' },
} as const

// Valor sempre com sinal e ícone: receita e gasto não dependem só da cor.
export function TransactionAmount({ transaction }: { transaction: Transaction }) {
  const kind = KIND[kindOf(transaction)]
  return (
    <span className={`font-semibold tabular-nums whitespace-nowrap ${kind.text}`}>
      <span className="sr-only">{kind.label}: </span>
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

export function TransactionCategory({ transaction }: { transaction: Transaction }) {
  if (transaction.vaultId !== null) return <span className="text-vault-text">Cofre</span>
  if (transaction.categoryName === null) return <span className="text-muted">Sem categoria</span>
  return <span className="text-foreground">{transaction.categoryName}</span>
}
