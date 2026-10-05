import { Link } from 'react-router'
import type { Transaction } from '../../api/types'
import { formatDate } from '../../lib/dates'
import { formatSigned } from '../../lib/money'
import { Icon } from '../ui/Icon'

interface TransactionListProps {
  items: Transaction[]
  onEdit: (transaction: Transaction) => void
  onDelete: (transaction: Transaction) => void
}

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
function Amount({ transaction }: { transaction: Transaction }) {
  const kind = KIND[kindOf(transaction)]
  return (
    <span className={`inline-flex items-center gap-1.5 font-semibold tabular-nums whitespace-nowrap ${kind.text}`}>
      <span className="sr-only">{kind.label}: </span>
      {formatSigned(transaction.amount)}
    </span>
  )
}

function KindIcon({ transaction }: { transaction: Transaction }) {
  const kind = kindOf(transaction)
  return (
    <span className={`flex size-9 shrink-0 items-center justify-center rounded-full bg-background ${KIND[kind].icon}`}>
      <Icon name={kind} className="size-5" />
    </span>
  )
}

function CategoryLabel({ transaction }: { transaction: Transaction }) {
  if (transaction.vaultId !== null) return <span className="text-vault-text">Cofre</span>
  if (transaction.categoryName === null) return <span className="text-muted">Sem categoria</span>
  return <span className="text-foreground">{transaction.categoryName}</span>
}

// Operações de cofre não têm editar nem apagar: só os endpoints de cofre as criam ou removem.
// No lugar, um link para o cofre.
function Actions({ transaction, onEdit, onDelete }: { transaction: Transaction } & Omit<TransactionListProps, 'items'>) {
  if (transaction.vaultId !== null) {
    return (
      <Link
        to={`/cofres/${transaction.vaultId}`}
        aria-label={`Ver cofre de ${transaction.description}`}
        className="inline-block rounded px-2 py-1 text-sm font-semibold whitespace-nowrap text-primary underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-primary"
      >
        Ver cofre
      </Link>
    )
  }
  const name = `${transaction.description} de ${formatDate(transaction.date)}`
  return (
    <div className="flex justify-end gap-1">
      <ActionButton icon="edit" label={`Editar ${name}`} onClick={() => onEdit(transaction)} />
      <ActionButton icon="trash" label={`Apagar ${name}`} onClick={() => onDelete(transaction)} />
    </div>
  )
}

function ActionButton({ icon, label, onClick }: { icon: 'edit' | 'trash'; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className="rounded-lg p-2 text-muted transition-colors hover:bg-background hover:text-foreground focus-visible:outline-2 focus-visible:outline-primary"
    >
      <Icon name={icon} className="size-4" />
    </button>
  )
}

export function TransactionList({ items, onEdit, onDelete }: TransactionListProps) {
  return (
    <>
      {/* Desktop: tabela */}
      <table className="hidden w-full text-left text-sm md:table">
        <thead className="border-b border-border text-muted">
          <tr>
            <th scope="col" className="px-4 py-3 font-medium">Data</th>
            <th scope="col" className="px-4 py-3 font-medium">Descrição</th>
            <th scope="col" className="px-4 py-3 font-medium">Categoria</th>
            <th scope="col" className="px-4 py-3 text-right font-medium">Valor</th>
            <th scope="col" className="px-4 py-3 text-right font-medium"><span className="sr-only">Ações</span></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {items.map((transaction) => (
            <tr key={transaction.id}>
              <td className="px-4 py-3 whitespace-nowrap text-muted tabular-nums">{formatDate(transaction.date)}</td>
              <td className="px-4 py-3">
                <div className="flex items-center gap-3">
                  <KindIcon transaction={transaction} />
                  <span className="break-words text-foreground">{transaction.description}</span>
                </div>
              </td>
              <td className="px-4 py-3"><CategoryLabel transaction={transaction} /></td>
              <td className="px-4 py-3 text-right"><Amount transaction={transaction} /></td>
              <td className="w-px px-2 py-3 text-right whitespace-nowrap">
                <Actions transaction={transaction} onEdit={onEdit} onDelete={onDelete} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Celular: cartões empilhados */}
      <ul className="divide-y divide-border md:hidden">
        {items.map((transaction) => (
          <li key={transaction.id} className="flex items-center gap-3 px-4 py-3">
            <KindIcon transaction={transaction} />
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline justify-between gap-3">
                <p className="min-w-0 truncate font-medium text-foreground" title={transaction.description}>
                  {transaction.description}
                </p>
                <Amount transaction={transaction} />
              </div>
              <div className="mt-0.5 flex items-center justify-between gap-3 text-sm">
                <p className="min-w-0 truncate">
                  <span className="text-muted tabular-nums">{formatDate(transaction.date)}</span>
                  <span className="text-muted" aria-hidden="true"> · </span>
                  <CategoryLabel transaction={transaction} />
                </p>
                <div className="-my-2 -mr-2 shrink-0">
                  <Actions transaction={transaction} onEdit={onEdit} onDelete={onDelete} />
                </div>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </>
  )
}
