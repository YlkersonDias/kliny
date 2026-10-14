import { lazy } from 'react'
import { useTranslation } from 'react-i18next'
import type { CategoryReportType, CategoryTotal } from '../../api/types'
import { useCategories } from '../../hooks/useCategories'
import { categoryLook } from '../../lib/categoryAppearance'
import { categoryName, formatPercent, toSlices, totalOf } from '../../lib/categoryChart'
import { formatMoney, formatOutflow, formatSigned } from '../../lib/money'
import { ChartFigure } from '../charts/ChartFigure'
import { CategoryIcon } from '../ui/CategoryIcon'
import { ChoiceChip } from '../ui/ChoiceChip'

const CategoryDonut = lazy(() => import('./CategoryDonut'))

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

export function CategorySection({ type, rows, onTypeChange, isRefreshing = false }: CategorySectionProps) {
  const { t } = useTranslation('reports')
  const isExpense = type === 'expense'
  const categories = useCategories()
  // Cada fatia na cor da categoria (sem categoria, cinza); categoria que não está na lista também.
  const slices = toSlices(rows, (id) => categoryLook(categories.data?.find((category) => category.id === id)))
  const total = totalOf(rows)
  const top = slices[0]

  return (
    <section aria-labelledby="por-categoria" className="rounded-2xl border border-border bg-surface p-5 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="por-categoria" className="text-lg font-semibold text-foreground">{t('category.title')}</h2>
        <fieldset className="flex gap-2">
          <legend className="sr-only">{t('category.show')}</legend>
          <ChoiceChip compact name="tipo-categoria" value="expense" checked={type === 'expense'} label={t('category.expense')} onChange={() => onTypeChange('expense')} />
          <ChoiceChip compact name="tipo-categoria" value="income" checked={type === 'income'} label={t('category.income')} onChange={() => onTypeChange('income')} />
        </fieldset>
      </div>

      <div aria-busy={isRefreshing || undefined} className={`mt-4 transition-opacity ${isRefreshing ? 'opacity-60' : ''}`}>
        {rows.length === 0 ? (
          <p className="text-sm text-muted">{isExpense ? t('category.noExpense') : t('category.noIncome')}</p>
        ) : (
          <ChartFigure
            labelledBy="por-categoria"
            heightClass="h-64"
            chart={(
              <div className="grid grid-cols-1 items-center gap-6 lg:grid-cols-[minmax(0,16rem)_minmax(0,1fr)]">
                <CategoryDonut slices={slices} total={total} totalLabel={isExpense ? t('category.totalExpense') : t('category.totalIncome')} />
                {/* Legenda visual (a tabela abaixo traz as mesmas informações para todos). */}
                <ol className="min-w-0 divide-y divide-border">
                  {slices.map((slice) => (
                    <li key={slice.key} className="grid grid-cols-[1.5rem_1.5rem_minmax(0,1fr)_auto_auto] items-center gap-2.5 py-2 text-sm tabular-nums">
                      <span className="flex size-[1.375rem] items-center justify-center rounded-full border-[1.5px] border-foreground bg-surface text-xs font-bold text-foreground">
                        {slice.rank}
                      </span>
                      {slice.look ? (
                        <CategoryIcon look={slice.look} size="size-6" />
                      ) : (
                        <span
                          className="size-3.5 justify-self-center rounded-[3px]"
                          style={{ background: 'repeating-linear-gradient(45deg, var(--color-border) 0 3px, var(--color-muted) 3px 4px)' }}
                        />
                      )}
                      <span className={`truncate ${slice.isUncategorized ? 'italic text-muted' : 'text-foreground'}`} title={slice.name}>
                        {slice.name}
                      </span>
                      <span className="text-right font-semibold text-foreground">{signed(type, slice.total)}</span>
                      <span className="min-w-[4.5ch] text-right text-muted">{t('category.percent', { value: formatPercent(slice.percentage) })}</span>
                    </li>
                  ))}
                </ol>
              </div>
            )}
            caption={(
              <>
                {t(isExpense ? 'category.captionExpense' : 'category.captionIncome', { total: formatMoney(total), count: rows.length })}
                {top && <>{' '}{t('category.top', { name: top.name, percent: formatPercent(top.percentage) })}</>}
                {slices.some((slice) => slice.isOther) && (
                  <>{' '}{t('category.grouped', { grouped: slices[slices.length - 1].groupedCount })}</>
                )}
              </>
            )}
            tableLabel={isExpense ? t('category.tableExpense') : t('category.tableIncome')}
            table={(
              <table className="w-full text-left">
                <caption className="sr-only">{isExpense ? t('category.tableCaptionExpense') : t('category.tableCaptionIncome')}</caption>
                <thead className="text-muted">
                  <tr>
                    <th scope="col" className="py-1.5 pr-3 font-medium">{t('category.position')}</th>
                    <th scope="col" className="py-1.5 pr-3 font-medium">{t('category.category')}</th>
                    <th scope="col" className="py-1.5 pr-3 text-right font-medium">{t('category.amount')}</th>
                    <th scope="col" className="py-1.5 pr-3 text-right font-medium">{t('category.percentage')}</th>
                    <th scope="col" className="py-1.5 text-right font-medium">{t('category.entries')}</th>
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
                      <td className="py-1.5 pr-3 text-right text-muted">{t('category.percent', { value: formatPercent(total === 0 ? 0 : (row.total / total) * 100) })}</td>
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
