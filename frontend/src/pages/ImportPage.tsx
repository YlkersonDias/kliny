import { useCallback, useRef, useState, type ChangeEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import type { ImportLine } from '../api/types'
import { ApiError } from '../api/client'
import { CsvColumnsStep } from '../components/imports/CsvColumnsStep'
import { DoneCard, Review, type Done, type Loaded } from '../components/imports/ImportReview'
import { Button } from '../components/ui/Button'
import { FormAlert } from '../components/ui/FormAlert'
import { Icon } from '../components/ui/Icon'
import { Spinner } from '../components/ui/Spinner'
import { useCategories } from '../hooks/useCategories'
import { useCategoryRules } from '../hooks/useCategoryRules'
import { useCheckImport, useImportLines } from '../hooks/useImports'
import { usePageTitle } from '../hooks/usePageTitle'
import { applyMapping, guessMapping, layoutKey, parseCsv, type CsvMapping } from '../lib/csv'
import { restoreMapping, saveMapping } from '../lib/csvMappingStore'
import { decodeStatement, IMPORT_MAX_LINES, OFX_MAX_BYTES, OfxError, parseOfx, type StatementLine } from '../lib/ofx'
import { buildReviewRows, dateSpan, type ReviewRow } from '../lib/statementImport'

// O arquivo é lido só aqui e descartado: a API recebe só as linhas marcadas.

interface CsvFile {
  fileName: string
  rows: string[][]
  mapping: CsvMapping
}

export default function ImportPage() {
  const { t } = useTranslation(['imports', 'common'])
  usePageTitle(t('title'))
  const categories = useCategories()
  const rules = useCategoryRules()
  const check = useCheckImport()
  const save = useImportLines()

  const [csv, setCsv] = useState<CsvFile | null>(null)
  const [choosingColumns, setChoosingColumns] = useState(false)
  const [loaded, setLoaded] = useState<Loaded | null>(null)
  const [done, setDone] = useState<Done | null>(null)
  const [fileError, setFileError] = useState<string | null>(null)
  const [reading, setReading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const ready = !rules.isPending && !categories.isPending

  async function handleFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    setFileError(null)
    setDone(null)
    setLoaded(null)
    setCsv(null)
    setChoosingColumns(false)
    check.reset()
    save.reset()

    if (file.size > OFX_MAX_BYTES) {
      setFileError(t('errors.tooBig'))
      return
    }

    setReading(true)
    let text: string
    try {
      text = decodeStatement(new Uint8Array(await file.arrayBuffer()))
    } catch {
      setReading(false)
      setFileError(t('errors.read'))
      return
    }

    // O conteúdo decide, e não a extensão: há banco que manda OFX com outro nome.
    if (/<OFX>/i.test(text)) {
      let result
      try {
        result = parseOfx(text)
      } catch (error) {
        setReading(false)
        setFileError(error instanceof OfxError ? t(`errors.${error.code}`) : t('errors.read'))
        return
      }
      review(file.name, result.lines, result.skipped)
      return
    }

    const { rows } = parseCsv(text)
    setReading(false)
    if (rows.length < 2 || rows.every((row) => row.length < 2)) {
      setFileError(t('errors.unknown'))
      return
    }
    const guessed = guessMapping(rows)
    const width = Math.max(...rows.map((row) => row.length))
    const mapping = guessed.hasHeader ? restoreMapping(layoutKey(rows[guessed.headerRow]), guessed, width) : guessed
    setCsv({ fileName: file.name, rows, mapping })
    setChoosingColumns(true)
  }

  function review(fileName: string, lines: StatementLine[], skipped: number) {
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
    setReading(true)
    check.mutate(lines.map(toImportLine), {
      onSuccess: ({ statuses }) => {
        setLoaded({ fileName, skipped, rows: buildReviewRows(lines, statuses, rules.data ?? []) })
        setChoosingColumns(false)
      },
      onSettled: () => setReading(false),
    })
  }

  function confirmColumns(mapping: CsvMapping) {
    if (!csv) return
    setFileError(null)
    check.reset()
    setCsv({ ...csv, mapping })
    if (mapping.hasHeader) saveMapping(layoutKey(csv.rows[mapping.headerRow]), mapping)
    const result = applyMapping(csv.rows, mapping)
    review(csv.fileName, result.lines, result.skipped)
  }

  function backToColumns() {
    save.reset()
    setLoaded(null)
    setChoosingColumns(true)
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
          setCsv(null)
        },
      },
    )
  }

  // O click() funciona mesmo com display: none.
  const fileInput = (
    <input
      ref={inputRef}
      type="file"
      accept=".ofx,.OFX,.csv,.CSV,.txt,application/x-ofx,text/csv"
      className="hidden"
      tabIndex={-1}
      aria-hidden="true"
      onChange={handleFile}
    />
  )

  const fileOrCheckError = fileError ?? (check.error ? errorMessage(check.error) : null)

  function renderStep() {
    if (done) return <DoneCard done={done} onAnother={chooseAnother} />
    if (loaded) {
      return (
        <Review
          loaded={loaded}
          categories={categories.data ?? []}
          saving={save.isPending}
          error={save.error ? errorMessage(save.error) : null}
          onRow={setRow}
          onSelectAll={selectAll}
          onSubmit={submit}
          onAnother={chooseAnother}
          onColumns={csv ? backToColumns : undefined}
        />
      )
    }
    if (csv && choosingColumns) {
      return (
        <CsvColumnsStep
          // Arquivo novo começa do zero; voltar da revisão mantém o que foi escolhido.
          key={csv.fileName + csv.rows.length}
          fileName={csv.fileName}
          rows={csv.rows}
          initial={csv.mapping}
          busy={reading}
          error={fileOrCheckError}
          onConfirm={confirmColumns}
          onAnother={chooseAnother}
        />
      )
    }
    return (
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
        {fileOrCheckError && (
          <div className="mt-4">
            <FormAlert>{fileOrCheckError}</FormAlert>
          </div>
        )}
      </section>
    )
  }

  return (
    <>
      <Link to="/movimentacoes" className="inline-flex min-h-11 items-center gap-1 text-sm font-medium text-primary hover:underline md:min-h-0">
        <Icon name="chevronLeft" className="size-4" />
        {t('back')}
      </Link>
      <h1 className="mt-2 text-2xl font-semibold text-foreground">{t('title')}</h1>
      {fileInput}

      <div className="mt-6 space-y-4">{renderStep()}</div>
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

// A validação vem por linha ("Lines[3].Amount"): a primeira mensagem de campo diz mais que a genérica.
function errorMessage(error: Error): string {
  if (error instanceof ApiError) return Object.values(error.fieldErrors)[0] ?? error.detail
  return error.message
}
