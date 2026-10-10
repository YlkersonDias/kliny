import { memo, useId } from 'react'
import { Trans, useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import type { Category } from '../../api/types'
import { formatDate } from '../../lib/dates'
import { formatSigned } from '../../lib/money'
import { dateSpan, type ReviewRow } from '../../lib/statementImport'
import { Button } from '../ui/Button'
import { buttonClass } from '../ui/buttonStyles'
import { FormAlert } from '../ui/FormAlert'

// Revisão e resultado da importação de extrato (8.3), iguais para OFX e CSV.

export interface Loaded {
  fileName: string
  skipped: number
  rows: ReviewRow[]
}

export interface Done {
  created: number
  skipped: number
  span: { from: string; to: string } | null
}

interface ReviewProps {
  loaded: Loaded
  categories: Category[]
  saving: boolean
  error: string | null
  onRow: (index: number, patch: Partial<ReviewRow>) => void
  onSelectAll: (selected: boolean) => void
  onSubmit: () => void
  onAnother: () => void
  // Só no CSV: volta à escolha das colunas.
  onColumns?: () => void
}

export function Review({ loaded, categories, saving, error, onRow, onSelectAll, onSubmit, onAnother, onColumns }: ReviewProps) {
  const { t } = useTranslation('imports')
  const { rows } = loaded
  const span = dateSpan(rows.map((row) => row.line))
  const selected = rows.filter((row) => row.selected && !row.disabled).length
  const imported = rows.filter((row) => row.flag === 'imported').length
  const toCheck = rows.filter((row) => row.flag === 'similar' || row.flag === 'transfer').length
  const byRules = rows.filter((row) => !row.disabled && row.rulePattern !== null).length
  const hasTransfer = rows.some((row) => row.flag === 'transfer')
  const hasSimilar = rows.some((row) => row.flag === 'similar')

  const actions = (
    <div className="flex flex-wrap gap-2">
      <Button onClick={onSubmit} isLoading={saving} disabled={selected === 0}>
        {t('review.submit', { count: selected })}
      </Button>
      {onColumns && <Button variant="secondary" onClick={onColumns} disabled={saving}>{t('review.columns')}</Button>}
      <Button variant="secondary" onClick={onAnother} disabled={saving}>{t('review.another')}</Button>
    </div>
  )

  return (
    <>
      <section className="space-y-2 rounded-2xl border border-border bg-surface p-5 text-foreground md:p-6">
        {span && (
          <p>
            <Trans
              t={t}
              i18nKey="review.summary"
              count={rows.length}
              values={{ from: formatDate(span.from), to: formatDate(span.to) }}
              // O nome do arquivo entra como elemento pronto, nunca pelo parser de tags.
              components={{ file: <strong className="break-all">{loaded.fileName}</strong> }}
            />
          </p>
        )}
        <p className="text-sm text-muted">{t('review.counts', { fresh: rows.length - imported - toCheck, imported, toCheck })}</p>
        {loaded.skipped > 0 && <p className="text-sm text-muted">{t('review.skipped', { count: loaded.skipped })}</p>}
        {byRules > 0 && <p className="text-sm text-muted">{t('review.rules', { count: byRules })}</p>}
      </section>

      {hasTransfer && <FormAlert variant="info">{t('review.transferNotice')}</FormAlert>}
      {hasSimilar && <FormAlert variant="info">{t('review.similarNotice')}</FormAlert>}
      {error && <FormAlert>{error}</FormAlert>}

      <div className="flex flex-wrap items-center justify-between gap-3">
        {actions}
        <div className="flex gap-2">
          <Button variant="ghost" onClick={() => onSelectAll(true)} disabled={saving}>{t('review.selectAll')}</Button>
          <Button variant="ghost" onClick={() => onSelectAll(false)} disabled={saving}>{t('review.selectNone')}</Button>
        </div>
      </div>

      <section aria-label={t('review.listLabel')} className="overflow-hidden rounded-2xl border border-border bg-surface">
        <ul className="divide-y divide-border">
          {rows.map((row, index) => (
            <ReviewRowItem key={index} row={row} index={index} categories={categories} disabled={saving} onRow={onRow} />
          ))}
        </ul>
      </section>

      {rows.length > 8 && actions}
    </>
  )
}

interface RowProps {
  row: ReviewRow
  index: number
  categories: Category[]
  disabled: boolean
  onRow: (index: number, patch: Partial<ReviewRow>) => void
}

// memo: marcar uma linha não redesenha as outras (o arquivo pode ter 1.000).
const ReviewRowItem = memo(function ReviewRowItem({ row, index, categories, disabled, onRow }: RowProps) {
  const { t } = useTranslation('imports')
  const checkboxId = useId()
  const { line } = row
  const income = line.amount > 0

  return (
    <li className={`flex flex-col gap-2 px-4 py-3 lg:flex-row lg:items-center lg:gap-4 ${row.disabled ? 'opacity-60' : ''}`}>
      <div className="flex min-w-0 flex-1 items-start gap-3">
        <input
          id={checkboxId}
          type="checkbox"
          className="mt-1 size-5 shrink-0 accent-primary"
          checked={row.selected}
          disabled={row.disabled || disabled}
          onChange={(event) => onRow(index, { selected: event.target.checked })}
        />
        <label htmlFor={checkboxId} className="min-w-0 flex-1">
          <span className="block break-words font-medium text-foreground">{line.description}</span>
          <span className="block text-sm text-muted">
            {formatDate(line.date)}
            {row.flag && (
              <>
                {' · '}
                <span className={row.flag === 'imported' ? 'text-muted' : 'font-medium text-vault-text'}>{t(`flag.${row.flag}`)}</span>
              </>
            )}
          </span>
        </label>
      </div>
      <div className="flex items-center justify-between gap-3 pl-8 lg:justify-end lg:pl-0">
        <select
          aria-label={t('review.category', { description: line.description })}
          className="min-h-11 w-full max-w-56 rounded-lg border border-border bg-surface px-2 py-1.5 text-sm text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 md:min-h-9"
          value={row.categoryId}
          disabled={row.disabled || disabled}
          onChange={(event) => onRow(index, { categoryId: event.target.value, rulePattern: null })}
        >
          <option value="">{t('review.noCategory')}</option>
          {categories.map((category) => (
            <option key={category.id} value={String(category.id)}>{category.name}</option>
          ))}
        </select>
        <span className={`w-32 shrink-0 text-right font-semibold tabular-nums whitespace-nowrap ${income ? 'text-income' : 'text-expense'}`}>
          <span className="sr-only">{t(income ? 'review.income' : 'review.expense')}{' '}</span>
          {formatSigned(line.amount)}
        </span>
      </div>
    </li>
  )
})

export function DoneCard({ done, onAnother }: { done: Done; onAnother: () => void }) {
  const { t } = useTranslation('imports')
  const params = done.span ? `?de=${done.span.from}&ate=${done.span.to}` : ''
  return (
    <section className="space-y-4 rounded-2xl border border-border bg-surface p-5 md:p-6">
      <FormAlert variant="info">
        <p className="font-medium">{t('done.title', { count: done.created })}</p>
        {done.skipped > 0 && <p>{t('done.skipped', { count: done.skipped })}</p>}
      </FormAlert>
      <div className="flex flex-wrap gap-2">
        <Link to={`/movimentacoes${params}`} className={buttonClass()}>
          {t('done.view')}
        </Link>
        <Button variant="secondary" onClick={onAnother}>{t('done.another')}</Button>
      </div>
    </section>
  )
}
