import { memo, useCallback, useId, useRef, useState, type ChangeEvent } from 'react'
import { Trans, useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import type { Category, ImportLine } from '../api/types'
import { ApiError } from '../api/client'
import { Button } from '../components/ui/Button'
import { buttonClass } from '../components/ui/buttonStyles'
import { FormAlert } from '../components/ui/FormAlert'
import { Icon } from '../components/ui/Icon'
import { Spinner } from '../components/ui/Spinner'
import { useCategories } from '../hooks/useCategories'
import { useCategoryRules } from '../hooks/useCategoryRules'
import { useCheckImport, useImportLines } from '../hooks/useImports'
import { usePageTitle } from '../hooks/usePageTitle'
import { formatDate } from '../lib/dates'
import { formatSigned } from '../lib/money'
import { decodeStatement, IMPORT_MAX_LINES, OFX_MAX_BYTES, OfxError, parseOfx, type StatementLine } from '../lib/ofx'
import { buildReviewRows, dateSpan, type ReviewRow } from '../lib/statementImport'

// Importação de extrato (8.3a, OFX). O arquivo é lido aqui e descartado; a API recebe só as
// linhas marcadas. Três passos: escolher o arquivo, revisar e o resultado.

interface Loaded {
  fileName: string
  skipped: number
  rows: ReviewRow[]
}

interface Done {
  created: number
  skipped: number
  span: { from: string; to: string } | null
}

export default function ImportPage() {
  const { t } = useTranslation(['imports', 'common'])
  usePageTitle(t('title'))
  const categories = useCategories()
  const rules = useCategoryRules()
  const check = useCheckImport()
  const save = useImportLines()

  const [loaded, setLoaded] = useState<Loaded | null>(null)
  const [done, setDone] = useState<Done | null>(null)
  const [fileError, setFileError] = useState<string | null>(null)
  const [reading, setReading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  // As regras sugerem a categoria; sem elas carregadas, a revisão sairia sem as sugestões.
  const ready = !rules.isPending && !categories.isPending

  async function handleFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    setFileError(null)
    setDone(null)
    setLoaded(null)
    check.reset()
    save.reset()

    if (file.size > OFX_MAX_BYTES) {
      setFileError(t('errors.tooBig'))
      return
    }

    setReading(true)
    let lines: StatementLine[]
    let skipped: number
    try {
      const result = parseOfx(decodeStatement(new Uint8Array(await file.arrayBuffer())))
      lines = result.lines
      skipped = result.skipped
    } catch (error) {
      setReading(false)
      setFileError(error instanceof OfxError ? t(`errors.${error.code}`) : t('errors.read'))
      return
    }
    if (lines.length === 0) {
      setReading(false)
      setFileError(t('errors.nothingValid'))
      return
    }
    if (lines.length > IMPORT_MAX_LINES) {
      setReading(false)
      setFileError(t('errors.tooMany', { total: lines.length, max: IMPORT_MAX_LINES }))
      return
    }

    check.mutate(lines.map(toImportLine), {
      onSuccess: ({ statuses }) => setLoaded({ fileName: file.name, skipped, rows: buildReviewRows(lines, statuses, rules.data ?? []) }),
      onSettled: () => setReading(false),
    })
  }

  function chooseAnother() {
    inputRef.current?.click()
  }

  const setRow = useCallback((index: number, patch: Partial<ReviewRow>) => {
    setLoaded((current) => current && {
      ...current,
      rows: current.rows.map((row, i) => (i === index ? { ...row, ...patch } : row)),
    })
  }, [])

  function selectAll(selected: boolean) {
    setLoaded((current) => current && {
      ...current,
      rows: current.rows.map((row) => (row.disabled ? row : { ...row, selected })),
    })
  }

  function submit() {
    if (!loaded) return
    const chosen = loaded.rows.filter((row) => row.selected && !row.disabled)
    if (chosen.length === 0) return
    save.mutate(
      chosen.map((row) => ({ ...toImportLine(row.line), categoryId: row.categoryId ? Number(row.categoryId) : null })),
      {
        onSuccess: (result) => {
          setDone({ ...result, span: dateSpan(chosen.map((row) => row.line)) })
          setLoaded(null)
        },
      },
    )
  }

  // Escondido: os botões abrem o seletor de arquivo (o click() funciona mesmo com display: none).
  const fileInput = (
    <input
      ref={inputRef}
      type="file"
      accept=".ofx,.OFX,application/x-ofx"
      className="hidden"
      tabIndex={-1}
      aria-hidden="true"
      onChange={handleFile}
    />
  )

  return (
    <>
      <Link to="/movimentacoes" className="inline-flex min-h-11 items-center gap-1 text-sm font-medium text-primary hover:underline md:min-h-0">
        <Icon name="chevronLeft" className="size-4" />
        {t('back')}
      </Link>
      <h1 className="mt-2 text-2xl font-semibold text-foreground">{t('title')}</h1>
      {fileInput}

      <div className="mt-6 space-y-4">
        {done ? (
          <DoneCard done={done} onAnother={chooseAnother} />
        ) : loaded ? (
          <Review
            loaded={loaded}
            categories={categories.data ?? []}
            saving={save.isPending}
            error={save.error ? errorMessage(save.error) : null}
            onRow={setRow}
            onSelectAll={selectAll}
            onSubmit={submit}
            onAnother={chooseAnother}
          />
        ) : (
          <section className="rounded-2xl border border-border bg-surface p-5 md:p-6">
            <div className="max-w-prose space-y-3 text-foreground">
              <p>{t('choose.intro')}</p>
              <p className="text-sm text-muted">{t('choose.where')}</p>
              <p className="flex gap-2 text-sm text-muted">
                <Icon name="shield" className="mt-0.5 size-4 text-primary" />
                <span>{t('choose.privacy')}</span>
              </p>
            </div>
            <div className="mt-5 flex flex-wrap items-center gap-3">
              <Button onClick={chooseAnother} disabled={!ready || reading}>
                <Icon name="plus" className="size-4" />
                {t('choose.pick')}
              </Button>
              {!ready && <span className="flex items-center gap-2 text-sm text-muted"><Spinner className="size-4" />{t('choose.loading')}</span>}
              {reading && <span role="status" className="flex items-center gap-2 text-sm text-muted"><Spinner className="size-4" />{t('choose.reading')}</span>}
            </div>
            {(fileError || check.error) && (
              <div className="mt-4">
                <FormAlert>{fileError ?? errorMessage(check.error!)}</FormAlert>
              </div>
            )}
          </section>
        )}
      </div>
    </>
  )
}

function toImportLine(line: StatementLine): ImportLine {
  return {
    source: line.source,
    externalId: line.externalId,
    date: line.date,
    amount: line.amount,
    description: line.description,
    occurrence: line.occurrence,
  }
}

// A API responde a validação por linha ("Lines[3].Amount"): a primeira mensagem de campo diz mais
// que o "Confira os campos destacados", que aqui não tem campo para destacar.
function errorMessage(error: Error): string {
  if (error instanceof ApiError) return Object.values(error.fieldErrors)[0] ?? error.detail
  return error.message
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
}

function Review({ loaded, categories, saving, error, onRow, onSelectAll, onSubmit, onAnother }: ReviewProps) {
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

function DoneCard({ done, onAnother }: { done: Done; onAnother: () => void }) {
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
