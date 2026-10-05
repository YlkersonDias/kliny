import { lazy } from 'react'
import type { CategoryReportType, CategoryTotal } from '../../api/types'
import { categoryName, toSlices, totalOf } from '../../lib/categoryChart'
import { formatMoney, formatOutflow, formatSigned } from '../../lib/money'
import { ChartFigure } from '../charts/ChartFigure'

const CategoryDonut = lazy(() => import('./CategoryDonut'))

const PCT = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })

interface CategorySectionProps {
  type: CategoryReportType
  rows: CategoryTotal[]
  onTypeChange: (type: CategoryReportType) => void
  // Prévia do período anterior enquanto o novo carrega.
  isRefreshing?: boolean
}

// Valores com sinal: gasto com "−" (o total vem positivo da API), receita com "+".
function signed(type: CategoryReportType, value: number): string {
  return type === 'expense' ? formatOutflow(value) : formatSigned(value)
}

function TypeChoice({ value, current, label, onChange }: {
  value: CategoryReportType
  current: CategoryReportType
  label: string
  onChange: (type: CategoryReportType) => void
}) {
  return (
    <label className="inline-flex cursor-pointer items-center rounded-lg border border-border px-3 py-1.5 text-sm font-semibold text-muted transition-colors hover:bg-background has-checked:border-primary has-checked:bg-primary has-checked:text-white has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-primary">
      <input type="radio" name="tipo-categoria" value={value} checked={current === value} onChange={() => onChange(value)} className="sr-only" />
      {label}
    </label>
  )
}

export function CategorySection({ type, rows, onTypeChange, isRefreshing = false }: CategorySectionProps) {
  const noun = type === 'expense' ? 'gastos' : 'receitas'
  const slices = toSlices(rows)
  const total = totalOf(rows)
  const top = slices[0]

  return (
    <section aria-labelledby="por-categoria" className="rounded-2xl border border-border bg-surface p-5 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="por-categoria" className="text-lg font-semibold text-foreground">Por categoria</h2>
        <fieldset className="flex gap-2">
          <legend className="sr-only">Mostrar</legend>
          <TypeChoice value="expense" current={type} label="Gastos" onChange={onTypeChange} />
          <TypeChoice value="income" current={type} label="Receitas" onChange={onTypeChange} />
        </fieldset>
      </div>

      <div aria-busy={isRefreshing || undefined} className={`mt-4 transition-opacity ${isRefreshing ? 'opacity-60' : ''}`}>
        {rows.length === 0 ? (
          <p className="text-sm text-muted">{type === 'expense' ? 'Nenhum gasto neste período.' : 'Nenhuma receita neste período.'}</p>
        ) : (
          <ChartFigure
            labelledBy="por-categoria"
            heightClass="h-64"
            chart={(
              <div className="grid grid-cols-1 items-center gap-6 md:grid-cols-[minmax(0,16rem)_minmax(0,1fr)]">
                <CategoryDonut slices={slices} total={total} totalLabel={`em ${noun}`} />
                {/* Legenda visual (a tabela abaixo traz as mesmas informações para todos). */}
                <ol className="min-w-0 divide-y divide-border">
                  {slices.map((slice) => (
                    <li key={slice.key} className="grid grid-cols-[1.5rem_0.875rem_minmax(0,1fr)_auto_auto] items-center gap-2.5 py-2 text-sm tabular-nums">
                      <span className="flex size-[1.375rem] items-center justify-center rounded-full border-[1.5px] border-foreground bg-surface text-xs font-bold text-foreground">
                        {slice.rank}
                      </span>
                      <span
                        className="size-3.5 rounded-[3px]"
                        style={slice.isOther
                          ? { background: 'repeating-linear-gradient(45deg, var(--color-border) 0 3px, var(--color-muted) 3px 4px)' }
                          : { background: slice.color }}
                      />
                      <span className={`truncate ${slice.isUncategorized ? 'italic text-muted' : 'text-foreground'}`} title={slice.name}>
                        {slice.name}
                      </span>
                      <span className="text-right font-semibold text-foreground">{signed(type, slice.total)}</span>
                      <span className="min-w-[4.5ch] text-right text-muted">{PCT.format(slice.percentage)}%</span>
                    </li>
                  ))}
                </ol>
              </div>
            )}
            caption={(
              <>
                {formatMoney(total)} em {noun} em {rows.length} {rows.length === 1 ? 'categoria' : 'categorias'}.
                {top && <> A maior é {top.name}, com {PCT.format(top.percentage)}%.</>}
                {slices.some((slice) => slice.isOther) && (
                  <> As {slices[slices.length - 1].groupedCount} menores aparecem juntas em “Outras”; a tabela lista todas.</>
                )}
              </>
            )}
            tableLabel={`Ver ${noun} por categoria em tabela`}
            table={(
              <table className="w-full text-left">
                <caption className="sr-only">{type === 'expense' ? 'Gastos' : 'Receitas'} por categoria no período</caption>
                <thead className="text-muted">
                  <tr>
                    <th scope="col" className="py-1.5 pr-3 font-medium">Posição</th>
                    <th scope="col" className="py-1.5 pr-3 font-medium">Categoria</th>
                    <th scope="col" className="py-1.5 pr-3 text-right font-medium">Valor</th>
                    <th scope="col" className="py-1.5 pr-3 text-right font-medium">Percentual</th>
                    <th scope="col" className="py-1.5 text-right font-medium">Lançamentos</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border tabular-nums">
                  {rows.map((row, index) => (
                    <tr key={row.categoryId ?? 'sem-categoria'}>
                      <td className="py-1.5 pr-3 text-muted">{index + 1}</td>
                      <th scope="row" className={`py-1.5 pr-3 font-normal ${row.categoryId === null ? 'italic text-muted' : 'text-foreground'}`}>
                        {categoryName(row)}
                      </th>
                      <td className="py-1.5 pr-3 text-right text-foreground">{signed(type, row.total)}</td>
                      <td className="py-1.5 pr-3 text-right text-muted">{PCT.format(total === 0 ? 0 : (row.total / total) * 100)}%</td>
                      <td className="py-1.5 text-right text-muted">{row.count}</td>
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
