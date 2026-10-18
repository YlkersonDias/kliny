import { useTranslation } from 'react-i18next'
import { Bar, BarChart, Cell, ReferenceLine, ResponsiveContainer, Tooltip, XAxis } from 'recharts'
import type { DaySpending } from '../../lib/dashboard'
import { formatMoney } from '../../lib/money'

// Carregado sob demanda: o Recharts fica fora do bundle inicial.

const TODAY_LABEL = { position: 'top', fill: 'var(--color-primary)', fontSize: 12, fontWeight: 600 } as const

interface SpendingChartProps {
  days: DaySpending[]
  todayDay: number
}

export default function SpendingChart({ days, todayDay }: SpendingChartProps) {
  const { t } = useTranslation('dashboard')
  const lastDay = days.length > 0 ? days[days.length - 1].day : 1

  return (
    <div className="h-36">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={days} margin={{ top: 18, right: 4, bottom: 0, left: 4 }} barCategoryGap="15%" accessibilityLayer={false}>
          <XAxis
            dataKey="day"
            ticks={[1, todayDay, lastDay].filter((day, index, all) => all.indexOf(day) === index)}
            interval={0}
            tickLine={false}
            axisLine={{ stroke: 'var(--color-border)' }}
            tick={{ fill: 'var(--color-muted)', fontSize: 12 }}
          />
          <Tooltip
            cursor={{ fill: 'var(--color-background)' }}
            formatter={(value) => [formatMoney(Number(value)), t('spending.spent')]}
            labelFormatter={(day) => t('spending.tooltipDay', { day })}
            contentStyle={{ borderRadius: 8, borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface)', fontSize: 13 }}
            labelStyle={{ color: 'var(--color-foreground)', fontWeight: 600 }}
            itemStyle={{ color: 'var(--color-foreground)' }}
          />
          <ReferenceLine
            x={todayDay}
            stroke="var(--color-primary)"
            strokeDasharray="3 3"
            label={{ ...TODAY_LABEL, value: t('spending.today') }}
          />
          <Bar dataKey="expense" radius={[3, 3, 0, 0]} minPointSize={2} isAnimationActive={false}>
            {days.map((day) => (
              <Cell
                key={day.date}
                // Dia futuro ou sem gasto em cinza.
                fill={day.expense > 0 && !day.isFuture ? 'var(--color-expense)' : 'var(--color-border)'}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
