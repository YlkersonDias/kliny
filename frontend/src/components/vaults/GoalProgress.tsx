import { formatMoney } from '../../lib/money'
import { goalProgress } from '../../lib/vaults'

interface GoalProgressProps {
  balance: number
  goal: number | null
  className?: string
}

// Barra em âmbar (vault só em barras e ícones) e, embaixo, a meta e o percentual em muted. O valor
// guardado não se repete aqui: nos três lugares (cartão, detalhe e Dashboard) ele já aparece em
// destaque. A linha fica acessível (alguns leitores pulam a barra no modo de leitura).
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
        aria-valuetext={progress.reached
          ? `Meta de ${formatMoney(goal)} atingida`
          : `${progress.percent}% da meta de ${formatMoney(goal)}`}
        className="h-2 overflow-hidden rounded-full bg-background"
      >
        {/* Âmbar até atingir; verde (income) quando atinge. Exceção à regra do âmbar de cofre,
            decidida pelo usuário (ver "Exceções de cor dos cofres" no CLAUDE.md). */}
        <div className={`h-full rounded-full ${progress.reached ? 'bg-income' : 'bg-vault'}`} style={{ width: `${progress.percent}%` }} />
      </div>
      <p className="mt-1.5 flex flex-wrap justify-between gap-x-3 text-sm text-muted tabular-nums">
        <span className="wrap-anywhere">Meta {formatMoney(goal)}</span>
        <span>{progress.reached ? 'Atingida' : `${progress.percent}%`}</span>
      </p>
    </div>
  )
}
