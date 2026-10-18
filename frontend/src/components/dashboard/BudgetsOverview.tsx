import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useBudgets } from '../../hooks/useBudgets'
import { useCategories } from '../../hooks/useCategories'
import { budgetProgress, type BudgetStatus } from '../../lib/budgets'
import { formatMoney } from '../../lib/money'
import { BudgetsModal } from '../budgets/BudgetsModal'
import { Button } from '../ui/Button'
import { CategoryIcon } from '../ui/CategoryIcon'
import { FormAlert } from '../ui/FormAlert'

// O texto sempre diz a situação: nunca só a cor.
const BAR: Record<BudgetStatus, string> = { ok: 'bg-primary', near: 'bg-vault', over: 'bg-expense' }
const TEXT: Record<BudgetStatus, string> = { ok: 'text-muted', near: 'text-vault-text', over: 'text-expense' }

export function BudgetsOverview({ month }: { month: string }) {
  const { t } = useTranslation(['dashboard', 'common'])
  const budgets = useBudgets(month)
  // Só para a cor e o ícone de cada categoria.
  const categories = useCategories()
  const [managing, setManaging] = useState(false)

  function statusText(status: BudgetStatus, difference: number): string {
    const amount = formatMoney(difference)
    if (status === 'over') return t('budgets.over', { amount })
    if (difference === 0) return t('budgets.reached')
    return status === 'near' ? t('budgets.near', { amount }) : t('budgets.remaining', { amount })
  }

  return (
    <section aria-labelledby="orcamento-mes" className="rounded-2xl border border-border bg-surface p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h2 id="orcamento-mes" className="text-lg font-semibold text-foreground">{t('budgets.title')}</h2>
        <button
          type="button"
          onClick={() => setManaging(true)}
          className="rounded text-sm font-semibold text-primary underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-primary"
        >
          {t('budgets.manage')}
        </button>
      </div>

      {budgets.isError ? (
        <div className="mt-3 space-y-3">
          <FormAlert>{t('budgets.loadError', { message: budgets.error.message })}</FormAlert>
          <Button variant="secondary" onClick={() => budgets.refetch()}>{t('common:actions.tryAgain')}</Button>
        </div>
      ) : !budgets.data ? (
        <div role="status" className="mt-4 h-24 rounded-lg bg-background motion-safe:animate-pulse">
          <span className="sr-only">{t('common:loading')}</span>
        </div>
      ) : budgets.data.length === 0 ? (
        <p className="mt-3 text-sm text-muted">{t('budgets.none')}</p>
      ) : (
        <ul className="mt-4 space-y-5">
          {budgets.data.map((budget) => {
            const progress = budgetProgress(budget.limit, budget.spent)
            return (
              <li key={budget.categoryId}>
                <div className="flex items-center justify-between gap-3">
                  <span className="flex min-w-0 items-center gap-2">
                    <CategoryIcon category={categories.data?.find((category) => category.id === budget.categoryId)} size="size-7" />
                    <span className="min-w-0 truncate font-medium text-foreground" title={budget.categoryName}>{budget.categoryName}</span>
                  </span>
                  <span className="shrink-0 text-sm tabular-nums text-foreground">
                    {t('budgets.spentOf', { spent: formatMoney(budget.spent), limit: formatMoney(budget.limit) })}
                  </span>
                </div>
                <div
                  role="progressbar"
                  aria-label={t('budgets.progressLabel', { category: budget.categoryName })}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={progress.bar}
                  aria-valuetext={`${t('budgets.progressValue', { percent: progress.percent, limit: formatMoney(budget.limit) })} ${statusText(progress.status, progress.difference)}`}
                  className="mt-2 h-2 overflow-hidden rounded-full bg-background"
                >
                  <div className={`h-full rounded-full ${BAR[progress.status]}`} style={{ width: `${progress.bar}%` }} />
                </div>
                <p className={`mt-1.5 flex flex-wrap justify-between gap-x-3 text-sm tabular-nums ${TEXT[progress.status]}`}>
                  <span className={progress.status === 'ok' ? '' : 'font-semibold'}>{statusText(progress.status, progress.difference)}</span>
                  <span>{t('budgets.percent', { percent: progress.percent })}</span>
                </p>
              </li>
            )
          })}
        </ul>
      )}

      {managing && <BudgetsModal budgets={budgets.data ?? []} onClose={() => setManaging(false)} />}
    </section>
  )
}
