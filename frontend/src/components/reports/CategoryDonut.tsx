import { Cell, Pie, PieChart, ResponsiveContainer, type PieLabelRenderProps } from 'recharts'
import type { CategorySlice } from '../../lib/categoryChart'
import { formatMoney } from '../../lib/money'

// Carregado sob demanda (React.lazy). Só visual: o ChartFigure o esconde do leitor de tela.
// As fatias se diferenciam pelo número (selo branco, 17:1 sobre qualquer tom), pela ordem
// (horário a partir do topo, do maior para o menor) e pelo traço branco entre elas; a cor
// da escala só reforça a posição. "Outras" usa hachura neutra.

const RADIAN = Math.PI / 180
// Fatias menores que isso ficam sem selo (o número continua na legenda).
const MIN_BADGE_PERCENT = 0.05

function Badge(props: PieLabelRenderProps) {
  const { cx, cy, midAngle, innerRadius, outerRadius, percent, index } = props
  if (percent === undefined || percent < MIN_BADGE_PERCENT || midAngle === undefined) return null
  const radius = (Number(innerRadius) + Number(outerRadius)) / 2
  const x = Number(cx) + radius * Math.cos(-midAngle * RADIAN)
  const y = Number(cy) + radius * Math.sin(-midAngle * RADIAN)
  return (
    <g>
      <circle cx={x} cy={y} r={11} fill="var(--color-surface)" stroke="var(--color-foreground)" strokeWidth={1.5} />
      <text x={x} y={y} dy={4.2} textAnchor="middle" fontSize={12} fontWeight={700} fill="var(--color-foreground)">
        {Number(index) + 1}
      </text>
    </g>
  )
}

export default function CategoryDonut({ slices, total, totalLabel }: { slices: CategorySlice[]; total: number; totalLabel: string }) {
  return (
    <div className="relative mx-auto aspect-square w-full max-w-64">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart accessibilityLayer={false}>
          <defs>
            <pattern id="hachura-outras" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
              <rect width="6" height="6" fill="var(--color-border)" />
              <rect width="1.5" height="6" fill="var(--color-muted)" />
            </pattern>
          </defs>
          <Pie
            data={slices}
            dataKey="total"
            nameKey="name"
            startAngle={90}
            endAngle={-270}
            innerRadius="52%"
            outerRadius="94%"
            stroke="var(--color-surface)"
            strokeWidth={2}
            isAnimationActive={false}
            // O Pie vem com tabindex 0 mesmo com accessibilityLayer={false}: dentro do aria-hidden,
            // o foco cairia num elemento que o leitor de tela não anuncia.
            rootTabIndex={-1}
            label={Badge}
            labelLine={false}
          >
            {slices.map((slice) => (
              <Cell key={slice.key} fill={slice.isOther ? 'url(#hachura-outras)' : slice.color} />
            ))}
          </Pie>
        </PieChart>
      </ResponsiveContainer>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
        <span className="text-lg font-bold tabular-nums text-foreground">{formatMoney(total)}</span>
        <span className="text-xs text-muted">{totalLabel}</span>
      </div>
    </div>
  )
}
