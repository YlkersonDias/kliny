import { useId, useState } from 'react'
import { Trans, useTranslation } from 'react-i18next'
import { applyMapping, mapRow, mappingError, type CsvMapping, type DateFormat } from '../../lib/csv'
import { formatDate } from '../../lib/dates'
import { formatSigned } from '../../lib/money'
import { Button } from '../ui/Button'
import { FormAlert } from '../ui/FormAlert'
import { Select } from '../ui/Select'

interface CsvColumnsStepProps {
  fileName: string
  rows: string[][]
  initial: CsvMapping
  busy: boolean
  error: string | null
  onConfirm: (mapping: CsvMapping) => void
  onAnother: () => void
}

const PREVIEW_ROWS = 5

export function CsvColumnsStep({ fileName, rows, initial, busy, error, onConfirm, onAnother }: CsvColumnsStepProps) {
  const { t } = useTranslation('imports')
  const [mapping, setMapping] = useState(initial)
  const [split, setSplit] = useState(initial.amount === null && (initial.credit !== null || initial.debit !== null))
  const headerId = useId()
  const invertId = useId()

  const header = rows[mapping.headerRow] ?? []
  const width = Math.max(...rows.map((row) => row.length))
  const data = rows.slice(mapping.headerRow + (mapping.hasHeader ? 1 : 0))
  const effective: CsvMapping = split ? { ...mapping, amount: null } : { ...mapping, credit: null, debit: null }
  // No máximo 1.000 linhas: refazer a cada troca é barato.
  const result = applyMapping(rows, effective)
  const missing = mappingError(effective)

  function set<K extends keyof CsvMapping>(field: K, value: CsvMapping[K]) {
    setMapping((current) => ({ ...current, [field]: value }))
  }

  const columns = Array.from({ length: width }, (_, i) => {
    const sample = data.find((row) => (row[i] ?? '') !== '')?.[i] ?? ''
    const name = mapping.hasHeader && header[i] ? header[i] : t('columns.column', { n: i + 1 })
    return { value: String(i), label: sample ? t('columns.option', { name, sample: sample.slice(0, 30) }) : name }
  })
  const options = (optional: boolean) => (
    <>
      {optional && <option value="">{t('columns.none')}</option>}
      {columns.map((column) => <option key={column.value} value={column.value}>{column.label}</option>)}
    </>
  )
  const toIndex = (value: string) => (value === '' ? null : Number(value))

  return (
    <section className="space-y-5 rounded-2xl border border-border bg-surface p-5 md:p-6">
      <div className="space-y-2 text-foreground">
        <h2 className="text-lg font-semibold">{t('columns.title')}</h2>
        <p>
          <Trans t={t} i18nKey="columns.intro" components={{ file: <strong className="break-all">{fileName}</strong> }} />
        </p>
      </div>

      <div className="flex items-center gap-3">
        <input
          id={headerId}
          type="checkbox"
          className="size-5 accent-primary"
          checked={mapping.hasHeader}
          onChange={(event) => set('hasHeader', event.target.checked)}
        />
        <label htmlFor={headerId} className="text-foreground">{t('columns.hasHeader')}</label>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Select label={t('columns.date')} value={String(mapping.date)} onChange={(event) => set('date', Number(event.target.value))}>
          {options(false)}
        </Select>
        <Select label={t('columns.dateFormat')} value={mapping.dateFormat} onChange={(event) => set('dateFormat', event.target.value as DateFormat)}>
          <option value="dmy">{t('columns.formats.dmy')}</option>
          <option value="ymd">{t('columns.formats.ymd')}</option>
          <option value="mdy">{t('columns.formats.mdy')}</option>
        </Select>
        <Select label={t('columns.description')} value={String(mapping.description)} onChange={(event) => set('description', Number(event.target.value))}>
          {options(false)}
        </Select>
        <Select
          label={t('columns.description2')}
          hint={t('columns.description2Hint')}
          value={mapping.description2 === null ? '' : String(mapping.description2)}
          onChange={(event) => set('description2', toIndex(event.target.value))}
        >
          {options(true)}
        </Select>
        <Select
          label={t('columns.amountMode')}
          value={split ? 'split' : 'single'}
          onChange={(event) => setSplit(event.target.value === 'split')}
        >
          <option value="single">{t('columns.single')}</option>
          <option value="split">{t('columns.split')}</option>
        </Select>
        {split ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <Select
              label={t('columns.credit')}
              value={mapping.credit === null ? '' : String(mapping.credit)}
              error={missing ? t('columns.amountMissing') : undefined}
              onChange={(event) => set('credit', toIndex(event.target.value))}
            >
              {options(true)}
            </Select>
            <Select
              label={t('columns.debit')}
              value={mapping.debit === null ? '' : String(mapping.debit)}
              onChange={(event) => set('debit', toIndex(event.target.value))}
            >
              {options(true)}
            </Select>
          </div>
        ) : (
          <Select
            label={t('columns.amount')}
            value={mapping.amount === null ? '' : String(mapping.amount)}
            error={missing ? t('columns.amountMissing') : undefined}
            onChange={(event) => set('amount', toIndex(event.target.value))}
          >
            {mapping.amount === null && <option value="">{t('columns.choose')}</option>}
            {options(false)}
          </Select>
        )}
        <Select
          label={t('columns.id')}
          hint={t('columns.idHint')}
          value={mapping.id === null ? '' : String(mapping.id)}
          onChange={(event) => set('id', toIndex(event.target.value))}
        >
          {options(true)}
        </Select>
      </div>

      <div className="flex items-start gap-3">
        <input
          id={invertId}
          type="checkbox"
          className="mt-0.5 size-5 shrink-0 accent-primary"
          checked={mapping.invert}
          onChange={(event) => set('invert', event.target.checked)}
        />
        <label htmlFor={invertId} className="text-foreground">
          {t('columns.invert')}
          <span className="block text-sm text-muted">{t('columns.invertHint')}</span>
        </label>
      </div>

      <div className="space-y-2">
        <h3 className="font-medium text-foreground">{t('columns.preview')}</h3>
        <ul className="divide-y divide-border rounded-lg border border-border">
          {data.slice(0, PREVIEW_ROWS).map((row, i) => {
            const line = missing ? null : mapRow(row, effective)
            return (
              <li key={i} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 px-3 py-2 text-sm">
                {line ? (
                  <>
                    <span className="min-w-0 text-foreground">
                      <span className="text-muted">{formatDate(line.date)}</span>{' · '}<span className="break-words">{line.description}</span>
                    </span>
                    <span className={`font-semibold tabular-nums whitespace-nowrap ${line.amount > 0 ? 'text-income' : 'text-expense'}`}>
                      <span className="sr-only">{t(line.amount > 0 ? 'review.income' : 'review.expense')}{' '}</span>
                      {formatSigned(line.amount)}
                    </span>
                  </>
                ) : (
                  <span className="text-muted">{t('columns.ignored', { row: row.join(' | ').slice(0, 80) })}</span>
                )}
              </li>
            )
          })}
        </ul>
        {!missing && (
          <p className="text-sm text-muted" role="status">
            {t('columns.count', { count: result.lines.length })}
            {result.skipped > 0 && <>{' '}{t('columns.skipped', { count: result.skipped })}</>}
          </p>
        )}
      </div>

      {error && <FormAlert>{error}</FormAlert>}

      <div className="flex flex-wrap gap-2">
        <Button onClick={() => onConfirm(effective)} isLoading={busy} disabled={missing !== null || result.lines.length === 0}>
          {t('columns.continue')}
        </Button>
        <Button variant="secondary" onClick={onAnother} disabled={busy}>{t('review.another')}</Button>
      </div>
    </section>
  )
}
