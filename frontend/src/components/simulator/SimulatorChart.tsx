import { useTranslation } from 'react-i18next'
import { Area, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis } from 'recharts'
import { formatMoney } from '../../lib/money'
import type { SimulationPoint } from '../../lib/simulator'

// Carregado sob demanda (React.lazy). Só visual: o ChartFigure o esconde do leitor de tela.
// O total simulado é a área cheia; o aportado, a linha tracejada (não depende só da cor).

export default function SimulatorChart({ points, label }: { points: SimulationPoint[]; label: (month: number) => string }) {
  const { t } = useTranslation('simulator')
  const data = points.map((point) => ({ ...point, axis: label(point.month) }))

  return (
    <div className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 8 }} accessibilityLayer={false}>
          <CartesianGrid vertical={false} stroke="var(--color-border)" />
          <XAxis
            dataKey="axis"
            tickLine={false}
            axisLine={{ stroke: 'var(--color-border)' }}
            tick={{ fill: 'var(--color-muted)', fontSize: 12 }}
            interval="preserveStartEnd"
            minTickGap={24}
          />
          <Tooltip
            cursor={{ stroke: 'var(--color-border)' }}
            formatter={(value, name) => [formatMoney(Number(value)), name === 'total' ? t('chart.legendTotal') : t('chart.legendContributed')]}
            contentStyle={{ borderRadius: 8, borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface)', fontSize: 13 }}
            labelStyle={{ color: 'var(--color-foreground)', fontWeight: 600 }}
            itemStyle={{ color: 'var(--color-foreground)' }}
          />
          <Area
            type="monotone"
            dataKey="total"
            stroke="var(--color-primary)"
            strokeWidth={2}
            fill="var(--color-primary)"
            fillOpacity={0.18}
            isAnimationActive={false}
          />
          <Line
            type="monotone"
            dataKey="contributed"
            stroke="var(--color-muted)"
            strokeWidth={2}
            strokeDasharray="5 4"
            dot={false}
            isAnimationActive={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}
