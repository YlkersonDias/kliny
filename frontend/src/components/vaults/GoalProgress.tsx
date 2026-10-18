import { useTranslation } from 'react-i18next'
import { formatMoney } from '../../lib/money'
import { goalProgress } from '../../lib/vaults'

interface GoalProgressProps {
  balance: number
  goal: number | null
  className?: string
}

// O valor guardado não se repete: onde a barra aparece, ele já está em destaque.
export function GoalProgress({ balance, goal, className = '' }: GoalProgressProps) {
  const { t } = useTranslation('vaults')
  if (goal === null) return <p className={`text-sm text-muted ${className}`}>{t('goal.none')}</p>

  const progress = goalProgress(balance, goal)
  return (
    <div className={className}>
      <div
        role="progressbar"
        aria-label={t('goal.progressLabel')}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={progress.percent}
        aria-valuetext={progress.reached
          ? t('goal.reachedValue', { goal: formatMoney(goal) })
          : t('goal.progressValue', { percent: progress.percent, goal: formatMoney(goal) })}
        className="h-2 overflow-hidden rounded-full bg-background"
      >
        {/* Âmbar até atingir; verde quando atinge. */}
        <div className={`h-full rounded-full ${progress.reached ? 'bg-income' : 'bg-vault'}`} style={{ width: `${progress.percent}%` }} />
      </div>
      <p className="mt-1.5 flex flex-wrap justify-between gap-x-3 text-sm text-muted tabular-nums">
        <span className="wrap-anywhere">{t('goal.line', { goal: formatMoney(goal) })}</span>
        <span>{progress.reached ? t('goal.reached') : t('goal.percent', { percent: progress.percent })}</span>
      </p>
    </div>
  )
}
