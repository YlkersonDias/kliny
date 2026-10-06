import { useTranslation } from 'react-i18next'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis } from 'recharts'
import type { TimelineGrouping, TimelinePoint } from '../../api/types'
import { formatMoney } from '../../lib/money'
import { axisLabel, periodLabel } from '../../lib/timelineChart'

// Carregado sob demanda (React.lazy). Só visual: o ChartFigure o esconde do leitor de tela.
// Receita sempre à esquerda e gasto à direita; a legenda em HTML traz ícone e sinal.

export default function TimelineBars({ points, grouping }: { points: TimelinePoint[]; grouping: TimelineGrouping }) {
  const { t } = useTranslation('reports')
  const data = points.map((point) => ({ ...point, axis: axisLabel(point.period, grouping) }))

  return (
    <div className="h-56">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 4, bottom: 0, left: 4 }} barGap={2} accessibilityLayer={false}>
          <CartesianGrid vertical={false} stroke="var(--color-border)" />
          <XAxis
            dataKey="axis"
            tickLine={false}
            axisLine={{ stroke: 'var(--color-border)' }}
            tick={{ fill: 'var(--color-muted)', fontSize: 12 }}
            interval="preserveStartEnd"
            minTickGap={16}
          />
          <Tooltip
            cursor={{ fill: 'var(--color-background)' }}
            labelFormatter={(_, payload) => {
              const period = payload?.[0]?.payload?.period
              return typeof period === 'string' ? periodLabel(period, grouping) : ''
            }}
            formatter={(value, name) => [formatMoney(Number(value)), name === 'income' ? t('timeline.income') : t('timeline.expense')]}
            contentStyle={{ borderRadius: 8, borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface)', fontSize: 13 }}
            labelStyle={{ color: 'var(--color-foreground)', fontWeight: 600 }}
            itemStyle={{ color: 'var(--color-foreground)' }}
          />
          <Bar dataKey="income" fill="var(--color-income)" radius={[3, 3, 0, 0]} isAnimationActive={false} />
          <Bar dataKey="expense" fill="var(--color-expense)" radius={[3, 3, 0, 0]} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
