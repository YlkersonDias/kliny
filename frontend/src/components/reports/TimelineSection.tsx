import { lazy } from 'react'
import { useTranslation } from 'react-i18next'
import type { TimelineGrouping, TimelinePoint } from '../../api/types'
import { formatMoney, formatOutflow, formatSigned } from '../../lib/money'
import { periodLabel, summarizeTimeline } from '../../lib/timelineChart'
import { ChartFigure } from '../charts/ChartFigure'
import { Icon } from '../ui/Icon'

const TimelineBars = lazy(() => import('./TimelineBars'))

interface TimelineSectionProps {
  points: TimelinePoint[]
  grouping: TimelineGrouping
  isRefreshing?: boolean
}

export function TimelineSection({ points, grouping, isRefreshing = false }: TimelineSectionProps) {
  const { t } = useTranslation('reports')
  const summary = summarizeTimeline(points, grouping)
  const byDay = grouping === 'day'
  const hasMovement = summary.activePeriods > 0

  return (
    <section aria-labelledby="ao-longo-do-tempo" className="rounded-2xl border border-border bg-surface p-5 sm:p-6">
      <h2 id="ao-longo-do-tempo" className="text-lg font-semibold text-foreground">{t('timeline.title')}</h2>
      <div aria-busy={isRefreshing || undefined} className={`mt-4 transition-opacity ${isRefreshing ? 'opacity-60' : ''}`}>
        {!hasMovement ? (
          <p className="text-sm text-muted">{t('timeline.none')}</p>
        ) : (
          <ChartFigure
            labelledBy="ao-longo-do-tempo"
            heightClass="h-56"
            before={(
              // Ícone e sinal: as barras não dependem só do verde e do vermelho.
              <ul className="flex flex-wrap gap-x-5 gap-y-1 text-sm">
                <li className="flex items-center gap-1.5 text-income">
                  <span className="size-3 rounded-[3px] bg-income" />
                  <Icon name="income" className="size-4" />
                  <span>{t('timeline.legendIncome')}</span>
                </li>
                <li className="flex items-center gap-1.5 text-expense">
                  <span className="size-3 rounded-[3px] bg-expense" />
                  <Icon name="expense" className="size-4" />
                  <span>{t('timeline.legendExpense')}</span>
                </li>
              </ul>
            )}
            chart={<TimelineBars points={points} grouping={grouping} />}
            caption={(
              <>
                {t(byDay ? 'timeline.captionDay' : 'timeline.captionMonth', {
                  income: formatMoney(summary.income),
                  expense: formatMoney(summary.expense),
                  active: summary.activePeriods,
                  periods: points.length,
                })}
                {summary.maxExpense && (
                  <>{' '}{t(byDay ? 'timeline.maxDay' : 'timeline.maxMonth', { label: summary.maxExpense.label, amount: formatMoney(summary.maxExpense.expense) })}</>
                )}
              </>
            )}
            tableLabel={byDay ? t('timeline.tableDay') : t('timeline.tableMonth')}
            table={(
              <table className="w-full text-left">
                <caption className="sr-only">{byDay ? t('timeline.tableCaptionDay') : t('timeline.tableCaptionMonth')}</caption>
                <thead className="text-muted">
                  <tr>
                    <th scope="col" className="py-1.5 pr-3 font-medium">{byDay ? t('timeline.day') : t('timeline.month')}</th>
                    <th scope="col" className="py-1.5 pr-3 text-right font-medium">{t('timeline.income')}</th>
                    <th scope="col" className="py-1.5 pr-3 text-right font-medium">{t('timeline.expense')}</th>
                    <th scope="col" className="py-1.5 text-right font-medium">{byDay ? t('timeline.netDay') : t('timeline.netMonth')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border tabular-nums">
                  {points.map((point) => (
                    <tr key={point.period}>
                      <th scope="row" className="py-1.5 pr-3 font-normal text-foreground">{periodLabel(point.period, grouping)}</th>
                      <td className="py-1.5 pr-3 text-right text-foreground">{formatSigned(point.income)}</td>
                      <td className="py-1.5 pr-3 text-right text-foreground">{formatOutflow(point.expense)}</td>
                      <td className="py-1.5 text-right text-foreground">{formatSigned(point.net)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          />
        )}
      </div>
    </section>
  )
}
