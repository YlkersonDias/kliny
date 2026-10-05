import { Link } from 'react-router'
import type { Vault } from '../../api/types'
import { formatMoney } from '../../lib/money'
import { GoalProgress } from '../vaults/GoalProgress'

const MAX_VAULTS = 3

const FOCUS = 'rounded underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-primary'
const LINK = `text-sm font-semibold text-primary ${FOCUS}`

export function VaultsOverview({ vaults }: { vaults: Vault[] }) {
  const shown = vaults.slice(0, MAX_VAULTS)

  return (
    <section aria-labelledby="cofres-resumo" className="rounded-2xl border border-border bg-surface p-5">
      <div className="flex items-baseline justify-between gap-3">
        <h2 id="cofres-resumo" className="text-lg font-semibold text-foreground">Cofres</h2>
        {vaults.length > 0 && (
          <Link to="/cofres" className={LINK}>
            {vaults.length > MAX_VAULTS ? `Ver todos (${vaults.length})` : 'Ver cofres'}
          </Link>
        )}
      </div>
      {shown.length === 0 ? (
        <p className="mt-3 text-sm text-muted">
          Nenhum cofre ainda. <Link to="/cofres" className={LINK}>Criar um cofre</Link>
        </p>
      ) : (
        <ul className="mt-4 space-y-5">
          {shown.map((vault) => (
            <li key={vault.id}>
              <div className="flex items-baseline justify-between gap-3">
                <Link to={`/cofres/${vault.id}`} className={`min-w-0 truncate font-medium text-foreground ${FOCUS}`} title={vault.name}>
                  {vault.name}
                </Link>
                <span className="shrink-0 text-sm font-semibold tabular-nums text-foreground">{formatMoney(vault.balance)}</span>
              </div>
              <GoalProgress balance={vault.balance} goal={vault.goal} className="mt-2" />
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
