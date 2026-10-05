import { Bar, BarChart, Cell, ReferenceLine, ResponsiveContainer, Tooltip, XAxis } from 'recharts'
import type { DaySpending } from '../../lib/dashboard'
import { formatMoney } from '../../lib/money'

// Carregado sob demanda (React.lazy): o Recharts fica fora do bundle inicial.
// Só visual: o ChartFigure o esconde do leitor de tela e oferece o resumo e a tabela.
// Cores pelos tokens (CSS), para o modo noturno só redefinir as variáveis.

interface SpendingChartProps {
  days: DaySpending[]
  todayDay: number
}

export default function SpendingChart({ days, todayDay }: SpendingChartProps) {
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
            formatter={(value) => [formatMoney(Number(value)), 'Gasto']}
            labelFormatter={(day) => `Dia ${day}`}
            contentStyle={{ borderRadius: 8, borderColor: 'var(--color-border)', fontSize: 13 }}
            labelStyle={{ color: 'var(--color-foreground)', fontWeight: 600 }}
            itemStyle={{ color: 'var(--color-foreground)' }}
          />
          <ReferenceLine
            x={todayDay}
            stroke="var(--color-primary)"
            strokeDasharray="3 3"
            label={{ value: 'hoje', position: 'top', fill: 'var(--color-primary)', fontSize: 12, fontWeight: 600 }}
          />
          <Bar dataKey="expense" radius={[3, 3, 0, 0]} minPointSize={2} isAnimationActive={false}>
            {days.map((day) => (
              <Cell
                key={day.date}
                // Gasto até hoje em expense; já lançado para depois de hoje, ou dia sem gasto, em cinza.
                fill={day.expense > 0 && !day.isFuture ? 'var(--color-expense)' : 'var(--color-border)'}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
