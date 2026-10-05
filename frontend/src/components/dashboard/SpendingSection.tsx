import { lazy } from 'react'
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

// Gastos por dia do mês: gráfico (só visual) com resumo em texto e tabela como alternativa.
export function SpendingSection({ points, today }: SpendingSectionProps) {
  const days = dailySpending(points, today)
  const summary = summarizeSpending(days)
  const withSpending = days.filter((day) => day.expense > 0)
  const todayDay = Number(today.slice(8, 10))

  if (withSpending.length === 0) {
    return (
      <section aria-labelledby="gastos-por-dia">
        <h3 id="gastos-por-dia" className="text-sm font-medium text-muted">Gastos por dia</h3>
        <p className="mt-2 text-sm text-muted">Nenhum gasto neste mês.</p>
      </section>
    )
  }

  return (
    <section aria-labelledby="gastos-por-dia">
      <h3 id="gastos-por-dia" className="text-sm font-medium text-muted">Gastos por dia</h3>
      <ChartFigure
        labelledBy="gastos-por-dia"
        heightClass="h-36"
        chart={<SpendingChart days={days} todayDay={todayDay} />}
        caption={(
          <>
            {summary.daysWithSpending > 0 ? (
              <>
                Até hoje, você gastou {formatMoney(summary.total)} em {summary.daysWithSpending}{' '}
                {summary.daysWithSpending === 1 ? 'dia' : 'dias'}.
                {summary.max && <> Maior gasto: dia {summary.max.day}, {formatMoney(summary.max.expense)}.</>}
              </>
            ) : (
              <>Nenhum gasto até hoje.</>
            )}
            {summary.futureTotal > 0 && <> Há {formatMoney(summary.futureTotal)} em gastos com data depois de hoje.</>}
          </>
        )}
        tableLabel="Ver gastos por dia em tabela"
        table={(
          <table className="w-full max-w-sm text-left">
            <caption className="sr-only">Gastos por dia neste mês</caption>
            <thead className="text-muted">
              <tr>
                <th scope="col" className="py-1.5 pr-4 font-medium">Dia</th>
                <th scope="col" className="py-1.5 text-right font-medium">Gasto</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {withSpending.map((day) => (
                <tr key={day.date}>
                  <th scope="row" className="py-1.5 pr-4 font-normal text-foreground tabular-nums">
                    {formatDate(day.date)}{day.isFuture && <span className="text-muted"> (depois de hoje)</span>}
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
