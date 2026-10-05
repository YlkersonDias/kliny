import { formatMoney } from '../../lib/money'
import { goalProgress } from '../../lib/vaults'

interface GoalProgressProps {
  balance: number
  goal: number | null
  className?: string
}

// Barra em âmbar (vault só em barras e ícones); o texto ao lado repete a informação em muted.
export function GoalProgress({ balance, goal, className = '' }: GoalProgressProps) {
  if (goal === null) return <p className={`text-sm text-muted ${className}`}>Sem meta</p>

  const progress = goalProgress(balance, goal)
  return (
    <div className={className}>
      <div
        role="progressbar"
        aria-label="Progresso da meta"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={progress.percent}
        aria-valuetext={`${progress.percent}% da meta de ${formatMoney(goal)}`}
        className="h-2 overflow-hidden rounded-full bg-background"
      >
        <div className="h-full rounded-full bg-vault" style={{ width: `${progress.percent}%` }} />
      </div>
      <p className="mt-1.5 text-sm text-muted">
        {formatMoney(Math.max(0, balance))} de {formatMoney(goal)} · {progress.percent}%
        {progress.reached ? ' · Meta atingida' : ` · Faltam ${formatMoney(progress.remaining)}`}
      </p>
    </div>
  )
}
