import { lazy } from 'react'
import { useTranslation } from 'react-i18next'
import type { TimelinePoint } from '../../api/types'
import { dailySpending, summarizeSpending } from '../../lib/dashboard'
import { formatDate } from '../../lib/dates'
import { formatMoney } from '../../lib/money'
import { ChartFigure } from '../charts/ChartFigure'

const SpendingChart = lazy(() => import('./SpendingChart'))

interface SpendingSectionProps {
  points: TimelinePoint[]
  today: string
}

export function SpendingSection({ points, today }: SpendingSectionProps) {
  const { t } = useTranslation('dashboard')
  const days = dailySpending(points, today)
  const summary = summarizeSpending(days)
  const withSpending = days.filter((day) => day.expense > 0)
  const todayDay = Number(today.slice(8, 10))

  if (withSpending.length === 0) {
    return (
      <section aria-labelledby="gastos-por-dia">
        <h3 id="gastos-por-dia" className="text-sm font-medium text-muted">{t('spending.title')}</h3>
        <p className="mt-2 text-sm text-muted">{t('spending.noneThisMonth')}</p>
      </section>
    )
  }

  return (
    <section aria-labelledby="gastos-por-dia">
      <h3 id="gastos-por-dia" className="text-sm font-medium text-muted">{t('spending.title')}</h3>
      <ChartFigure
        labelledBy="gastos-por-dia"
        heightClass="h-36"
        chart={<SpendingChart days={days} todayDay={todayDay} />}
        caption={(
          <>
            {summary.daysWithSpending > 0 ? (
              <>
                {t('spending.summary', { total: formatMoney(summary.total), count: summary.daysWithSpending })}
                {summary.max && <>{' '}{t('spending.max', { day: summary.max.day, amount: formatMoney(summary.max.expense) })}</>}
              </>
            ) : (
              t('spending.noneUntilToday')
            )}
            {summary.futureTotal > 0 && <>{' '}{t('spending.future', { amount: formatMoney(summary.futureTotal) })}</>}
          </>
        )}
        tableLabel={t('spending.tableLabel')}
        table={(
          <table className="w-full max-w-sm text-left">
            <caption className="sr-only">{t('spending.tableCaption')}</caption>
            <thead className="text-muted">
              <tr>
                <th scope="col" className="py-1.5 pr-4 font-medium">{t('spending.day')}</th>
                <th scope="col" className="py-1.5 text-right font-medium">{t('spending.spent')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {withSpending.map((day) => (
                <tr key={day.date}>
                  <th scope="row" className="py-1.5 pr-4 font-normal text-foreground tabular-nums">
                    {formatDate(day.date)}{day.isFuture && <span className="text-muted">{' '}{t('spending.afterToday')}</span>}
                  </th>
                  <td className="py-1.5 text-right text-foreground tabular-nums">{formatMoney(day.expense)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      />
    </section>
  )
}
