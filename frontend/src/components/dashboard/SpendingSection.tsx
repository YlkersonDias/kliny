import { lazy, Suspense } from 'react'
import type { TimelinePoint } from '../../api/types'
import { dailySpending, summarizeSpending } from '../../lib/dashboard'
import { formatDate } from '../../lib/dates'
import { formatMoney } from '../../lib/money'

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
    <figure aria-labelledby="gastos-por-dia" className="m-0">
      <h3 id="gastos-por-dia" className="text-sm font-medium text-muted">Gastos por dia</h3>
      {/* Mesma altura do gráfico enquanto o pedaço do Recharts carrega, para a tela não pular. */}
      <Suspense fallback={<div className="mt-2 h-36 rounded-lg bg-background motion-safe:animate-pulse" />}>
        <div className="mt-2">
          <SpendingChart days={days} todayDay={todayDay} />
        </div>
      </Suspense>
      <figcaption className="mt-2 text-sm text-muted">
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
      </figcaption>
      <details className="mt-2 text-sm">
        <summary className="cursor-pointer rounded font-semibold text-primary underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-primary">
          Ver gastos por dia em tabela
        </summary>
        <table className="mt-2 w-full max-w-sm text-left">
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
      </details>
    </figure>
  )
}
