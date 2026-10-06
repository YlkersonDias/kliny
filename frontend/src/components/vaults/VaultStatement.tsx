import { useTranslation } from 'react-i18next'
import type { Transaction } from '../../api/types'
import { formatDate } from '../../lib/dates'
import { formatSigned } from '../../lib/money'
import { vaultAmount } from '../../lib/vaults'
import { Icon } from '../ui/Icon'

// Extrato do ponto de vista do cofre: depósito positivo (entra no cofre) e retirada
// negativa, sempre com o rótulo ao lado. Em Movimentações o sinal é o da conta (o inverso).
// Cores: depósito em income e retirada em expense (ícone, valor e rótulo), como as linhas de
// Movimentações. É uma exceção ao âmbar de cofre, decidida pelo usuário: aqui a cor segue o saldo
// do cofre, e em Movimentações as operações de cofre continuam em âmbar (ver "Exceções de cor
// dos cofres" no CLAUDE.md).
export function VaultStatement({ items }: { items: Transaction[] }) {
  const { t } = useTranslation('vaults')
  return (
    <ul className="divide-y divide-border">
      {items.map((transaction) => {
        const amount = vaultAmount(transaction.amount)
        const isDeposit = amount > 0
        const color = isDeposit ? 'text-income' : 'text-expense'
        return (
          <li key={transaction.id} className="flex items-center gap-3 px-4 py-3 sm:px-5">
            <span className={`flex size-9 shrink-0 items-center justify-center rounded-full bg-background ${color}`}>
              <Icon name={isDeposit ? 'income' : 'expense'} className="size-5" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium text-foreground" title={transaction.description}>{transaction.description}</p>
              <p className="mt-0.5 text-sm text-muted tabular-nums">{formatDate(transaction.date)}</p>
            </div>
            <div className={`shrink-0 text-right ${color}`}>
              <p className="font-semibold tabular-nums whitespace-nowrap">{formatSigned(amount)}</p>
              <p className="text-sm">{isDeposit ? t('detail.deposit') : t('detail.withdrawal')}</p>
            </div>
          </li>
        )
      })}
    </ul>
  )
}
