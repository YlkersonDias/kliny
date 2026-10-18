import { lazy, useEffect, useId, useState } from 'react'
import type { TFunction } from 'i18next'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../auth/useAuth'
import { ChartFigure } from '../components/charts/ChartFigure'
import { ChoiceChip } from '../components/ui/ChoiceChip'
import { Input } from '../components/ui/Input'
import { MoneyInput } from '../components/ui/MoneyInput'
import { StatItem } from '../components/ui/StatItem'
import { usePageTitle } from '../hooks/usePageTitle'
import { formatMoney, MONEY_MAX } from '../lib/money'
import {
  parseSimulatorForm, simulate, SIMULATOR_MAX_RATE, type SimulatorError, type SimulatorField, type SimulatorForm,
} from '../lib/simulator'
import { readSimulatorForm, saveSimulatorForm } from '../lib/simulatorStore'

const SimulatorChart = lazy(() => import('../components/simulator/SimulatorChart'))

type SimulatorT = TFunction<'simulator'>

const EMPTY: SimulatorForm = { initial: '', monthly: '', rate: '', rateUnit: 'month', term: '', termUnit: 'year' }

function formatTerm(months: number, t: SimulatorT): string {
  const years = Math.floor(months / 12)
  const rest = months % 12
  if (years === 0) return t('period.months', { count: rest })
  if (rest === 0) return t('period.years', { count: years })
  return t('period.yearsAndMonths', { years: t('period.years', { count: years }), months: t('period.months', { count: rest }) })
}

function errorText(error: SimulatorError | undefined, form: SimulatorForm, t: SimulatorT): string | undefined {
  if (!error) return undefined
  if (error === 'rateTooHigh') {
    return form.rateUnit === 'month'
      ? t('errors.rateTooHighMonth', { max: SIMULATOR_MAX_RATE.month })
      : t('errors.rateTooHighYear', { max: SIMULATOR_MAX_RATE.year })
  }
  return t(`errors.${error}`)
}

// Só uma conta no navegador, com os valores digitados: nada vai para a API e nenhuma taxa é sugerida.
export default function SimulatorPage() {
  const { t } = useTranslation('simulator')
  usePageTitle(t('title'))
  const id = useId()
  const { user } = useAuth()
  const userId = user?.id
  const [form, setForm] = useState<SimulatorForm>(() => (userId !== undefined && readSimulatorForm(userId)) || EMPTY)
  // O erro de um campo só aparece depois de sair dele: digitando "0," a taxa ainda está pela metade.
  const [touched, setTouched] = useState<Partial<Record<SimulatorField, boolean>>>(() => ({
    initial: form.initial !== '', monthly: form.monthly !== '', rate: form.rate !== '', term: form.term !== '',
  }))

  useEffect(() => {
    if (userId !== undefined) saveSimulatorForm(userId, form)
  }, [userId, form])

  const parsed = parseSimulatorForm(form)
  const errors = parsed.status === 'ready' ? {} : parsed.errors
  const visibleError = (field: SimulatorField) => (touched[field] ? errorText(errors[field], form, t) : undefined)
  const result = parsed.status === 'ready' ? simulate(parsed.input) : null

  function change<K extends keyof SimulatorForm>(field: K, value: SimulatorForm[K]) {
    setForm((current) => ({ ...current, [field]: value }))
  }
  const touch = (field: SimulatorField) => setTouched((current) => ({ ...current, [field]: true }))

  function pointLabel(month: number, byMonth: boolean): string {
    return !byMonth && month % 12 === 0 ? t('chart.pointYear', { n: month / 12 }) : t('chart.pointMonth', { n: month })
  }

  function renderResult() {
    if (parsed.status === 'invalid' && Object.keys(parsed.errors).some((field) => touched[field as SimulatorField])) {
      return <p className="text-sm text-muted">{t('fixErrors')}</p>
    }
    if (!result) return <p className="text-sm text-muted">{t('incomplete')}</p>
    if (!result.ok) return <p role="alert" className="text-sm text-danger">{t('tooLarge', { max: formatMoney(MONEY_MAX) })}</p>

    const period = formatTerm(parsed.status === 'ready' ? parsed.input.months : 0, t)
    return (
      <>
        {/* Colunas pela largura do cartão (container query): em colunas estreitas, valores grandes quebravam. */}
        <dl className="grid gap-4 @lg:grid-cols-2">
          <StatItem className="@lg:col-span-2" label={t('result.total', { period })} value={formatMoney(result.total)} />
          <StatItem label={t('result.contributed')} value={formatMoney(result.contributed)} />
          <StatItem label={t('result.growth')} value={formatMoney(result.growth)} />
        </dl>

        <h3 id={`${id}-grafico`} className="mt-6 font-semibold text-foreground">{t('chart.title')}</h3>
        <ChartFigure
          labelledBy={`${id}-grafico`}
          heightClass="h-64"
          before={(
            // Traço contínuo no total e tracejado no aportado: não depende só da cor.
            <ul className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-sm text-muted">
              <li className="flex items-center gap-1.5">
                <span className="h-3 w-4 rounded-[3px] border-t-2 border-primary bg-primary/30" />
                {t('chart.legendTotal')}
              </li>
              <li className="flex items-center gap-1.5">
                <span className="h-3 w-4 rounded-[3px] border-t-2 border-dashed border-vault bg-vault/50" />
                {t('chart.legendContributed')}
              </li>
            </ul>
          )}
          chart={<SimulatorChart points={result.points} label={(month) => pointLabel(month, result.byMonth)} />}
          caption={t('chart.caption', {
            period,
            contributed: formatMoney(result.contributed),
            total: formatMoney(result.total),
            growth: formatMoney(result.growth),
          })}
          tableLabel={t('chart.tableLabel')}
          table={(
            <table className="w-full text-left">
              <caption className="sr-only">{t('chart.tableCaption')}</caption>
              <thead className="text-muted">
                <tr>
                  <th scope="col" className="py-1.5 pr-3 font-medium">{t('chart.period')}</th>
                  <th scope="col" className="py-1.5 pr-3 text-right font-medium">{t('chart.contributed')}</th>
                  <th scope="col" className="py-1.5 pr-3 text-right font-medium">{t('chart.growth')}</th>
                  <th scope="col" className="py-1.5 text-right font-medium">{t('chart.total')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border tabular-nums">
                {result.points.map((point) => (
                  <tr key={point.month}>
                    <th scope="row" className="py-1.5 pr-3 font-normal text-foreground">{pointLabel(point.month, result.byMonth)}</th>
                    <td className="py-1.5 pr-3 text-right text-foreground">{formatMoney(point.contributed)}</td>
                    <td className="py-1.5 pr-3 text-right text-foreground">{formatMoney(point.total - point.contributed)}</td>
                    <td className="py-1.5 text-right text-foreground">{formatMoney(point.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        />
      </>
    )
  }

  return (
    <>
      <h1 className="text-2xl font-semibold text-foreground">{t('title')}</h1>
      <p className="mt-1 text-sm text-muted">{t('subtitle')}</p>

      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)] lg:items-start">
        <section aria-labelledby={`${id}-valores`} className="rounded-2xl border border-border bg-surface p-5 sm:p-6">
          <h2 id={`${id}-valores`} className="text-lg font-semibold text-foreground">{t('form.title')}</h2>
          <form noValidate onSubmit={(event) => event.preventDefault()} className="mt-4 space-y-4">
            <MoneyInput
              label={t('form.initial')}
              value={form.initial}
              onChange={(value) => change('initial', value)}
              onBlur={() => touch('initial')}
              error={visibleError('initial')}
            />
            <MoneyInput
              label={t('form.monthly')}
              value={form.monthly}
              onChange={(value) => change('monthly', value)}
              onBlur={() => touch('monthly')}
              error={visibleError('monthly')}
            />

            <div>
              <Input
                label={t('form.rate')}
                inputMode="decimal"
                autoComplete="off"
                value={form.rate}
                onChange={(event) => change('rate', event.target.value)}
                onBlur={() => touch('rate')}
                error={visibleError('rate')}
                hint={t('form.rateHint')}
              />
              <fieldset className="mt-2">
                <legend className="sr-only">{t('form.rateUnit')}</legend>
                <div className="flex flex-wrap gap-2">
                  <ChoiceChip compact name={`${id}-taxa`} value="month" checked={form.rateUnit === 'month'} label={t('form.rateMonth')} onChange={() => change('rateUnit', 'month')} />
                  <ChoiceChip compact name={`${id}-taxa`} value="year" checked={form.rateUnit === 'year'} label={t('form.rateYear')} onChange={() => change('rateUnit', 'year')} />
                </div>
              </fieldset>
            </div>

            <div>
              <Input
                label={t('form.term')}
                inputMode="numeric"
                autoComplete="off"
                value={form.term}
                onChange={(event) => change('term', event.target.value)}
                onBlur={() => touch('term')}
                error={visibleError('term')}
              />
              <fieldset className="mt-2">
                <legend className="sr-only">{t('form.termUnit')}</legend>
                <div className="flex flex-wrap gap-2">
                  <ChoiceChip compact name={`${id}-prazo`} value="year" checked={form.termUnit === 'year'} label={t('form.termYears')} onChange={() => change('termUnit', 'year')} />
                  <ChoiceChip compact name={`${id}-prazo`} value="month" checked={form.termUnit === 'month'} label={t('form.termMonths')} onChange={() => change('termUnit', 'month')} />
                </div>
              </fieldset>
            </div>
          </form>
        </section>

        <section aria-labelledby={`${id}-resultado`} className="@container rounded-2xl border border-border bg-surface p-5 sm:p-6">
          <h2 id={`${id}-resultado`} className="text-lg font-semibold text-foreground">{t('result.title')}</h2>
          {/* Sempre junto ao resultado: o Kliny não promete nem indica rendimento. */}
          <p className="mt-3 rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-muted">{t('notice')}</p>
          <div className="mt-4">{renderResult()}</div>
        </section>
      </div>
    </>
  )
}
