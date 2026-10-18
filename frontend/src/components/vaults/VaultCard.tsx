import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import type { Vault } from '../../api/types'
import { formatMoney } from '../../lib/money'
import { Button } from '../ui/Button'
import { Icon } from '../ui/Icon'
import { IconButton } from '../ui/IconButton'
import type { VaultOperation } from './VaultOperationModal'
import { GoalProgress } from './GoalProgress'

interface VaultCardProps {
  vault: Vault
  onOperation: (operation: VaultOperation) => void
  onEdit: () => void
}

export function VaultCard({ vault, onOperation, onEdit }: VaultCardProps) {
  const { t } = useTranslation(['vaults', 'common'])
  return (
    <article className="flex flex-col rounded-2xl border border-border bg-surface p-5">
      <div className="flex items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-background text-vault">
          <Icon name="vault" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="font-semibold" title={vault.name}>
            {/* 28 px de altura (mínimo de 24 px do WCAG 2.2), já que o lápis fica ao lado. */}
            <Link
              to={`/cofres/${vault.id}`}
              className="inline-block max-w-full truncate rounded py-0.5 align-top leading-6 text-foreground underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-primary"
            >
              {vault.name}
            </Link>
          </h2>
          <p className="mt-0.5 text-2xl font-semibold tabular-nums wrap-anywhere text-foreground">{formatMoney(vault.balance)}</p>
        </div>
        <IconButton icon="edit" label={t('card.edit', { name: vault.name })} onClick={onEdit} className="-mr-2 -mt-2 md:-mr-1 md:-mt-1" />
      </div>
      <GoalProgress balance={vault.balance} goal={vault.goal} className="mt-4" />
      <div className="mt-auto flex gap-2 pt-5">
        <Button variant="secondary" className="flex-1 px-3 py-2" onClick={() => onOperation('deposit')}>
          <Icon name="income" className="size-4" />
          {t('common:actions.deposit')}
          <span className="sr-only">{' '}{t('card.depositTo', { name: vault.name })}</span>
        </Button>
        <Button variant="secondary" className="flex-1 px-3 py-2" onClick={() => onOperation('withdraw')}>
          <Icon name="expense" className="size-4" />
          {t('common:actions.withdraw')}
          <span className="sr-only">{' '}{t('card.withdrawFrom', { name: vault.name })}</span>
        </Button>
      </div>
    </article>
  )
}
