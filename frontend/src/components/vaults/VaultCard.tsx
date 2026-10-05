import { Link } from 'react-router'
import type { Vault } from '../../api/types'
import { formatMoney } from '../../lib/money'
import { Button } from '../ui/Button'
import { Icon } from '../ui/Icon'
import type { VaultOperation } from './VaultOperationModal'
import { GoalProgress } from './GoalProgress'

interface VaultCardProps {
  vault: Vault
  onOperation: (operation: VaultOperation) => void
}

export function VaultCard({ vault, onOperation }: VaultCardProps) {
  return (
    <article className="flex flex-col rounded-2xl border border-border bg-surface p-5">
      <div className="flex items-start gap-3">
        {/* Âmbar só no ícone. */}
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-background text-vault">
          <Icon name="vault" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="truncate font-semibold" title={vault.name}>
            <Link
              to={`/cofres/${vault.id}`}
              className="rounded text-foreground underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-primary"
            >
              {vault.name}
            </Link>
          </h2>
          <p className="mt-0.5 text-2xl font-semibold tabular-nums text-foreground">{formatMoney(vault.balance)}</p>
        </div>
      </div>
      <GoalProgress balance={vault.balance} goal={vault.goal} className="mt-4" />
      <div className="mt-auto flex gap-2 pt-5">
        <Button variant="secondary" className="flex-1 px-3 py-2" onClick={() => onOperation('deposit')}>
          <Icon name="income" className="size-4" />
          Depositar
          <span className="sr-only"> em {vault.name}</span>
        </Button>
        <Button variant="secondary" className="flex-1 px-3 py-2" onClick={() => onOperation('withdraw')}>
          <Icon name="expense" className="size-4" />
          Retirar
          <span className="sr-only"> de {vault.name}</span>
        </Button>
      </div>
    </article>
  )
}
