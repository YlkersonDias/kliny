import type { ReactNode, RefObject } from 'react'
import { useTranslation } from 'react-i18next'
import { LANGUAGE_SHORT_NAMES } from '../../lib/language'
import { formatMoney, formatOutflow, formatSigned } from '../../lib/money'
import { Icon } from '../ui/Icon'
import { Mascot } from './Mascot'

function Panel({ width, title, text, children }: { width: string; title: string; text: string; children: ReactNode }) {
  return (
    <article className={`flex w-[min(84vw,22rem)] flex-none snap-center flex-col gap-5 rounded-3xl border border-border bg-surface p-6 shadow-lg shadow-primary/10 ${width}`}>
      <div>
        <h3 className="font-display text-2xl leading-tight font-[680] tracking-[-0.02em]">{title}</h3>
        <p className="mt-1.5 max-w-[34ch] text-[0.95rem] text-muted">{text}</p>
      </div>
      {/* Exemplo visual de uma tela do app; o título e o texto acima já dizem o que ela faz. */}
      <div aria-hidden="true" className="rounded-2xl border border-border p-3.5 text-sm">{children}</div>
    </article>
  )
}

function Row({ title, sub, amount, kind }: { title: string; sub: string; amount: string; kind: 'income' | 'expense' }) {
  return (
    <div className="flex items-center gap-3 border-border px-1 py-2 not-first:border-t">
      <span className="min-w-0 flex-1 truncate">
        {title}
        <span className="block text-xs text-muted">{sub}</span>
      </span>
      <span className={`font-semibold tabular-nums ${kind === 'income' ? 'text-income' : 'text-expense'}`}>{amount}</span>
    </div>
  )
}

function Budget({ name, note, noteColor, percent, barColor }: { name: string; note: string; noteColor: string; percent: number; barColor: string }) {
  return (
    <div className="px-1 py-1.5">
      <div className="flex justify-between gap-2">
        <span>{name}</span>
        <span className={`text-xs ${noteColor}`}>{note}</span>
      </div>
      <div className="mt-1.5 h-1.5 rounded-full bg-background">
        <div className={`h-full rounded-full ${barColor}`} style={{ width: `${percent}%` }} />
      </div>
    </div>
  )
}

function Choice({ label, on = false, lang }: { label: string; on?: boolean; lang?: string }) {
  return (
    <span lang={lang} className={`rounded-lg border px-2.5 py-1 font-semibold ${on ? 'border-primary bg-primary text-on-primary' : 'border-border text-muted'}`}>
      {label}
    </span>
  )
}

// Fatias da rosca de exemplo: as cores da escala de categorias dos Relatórios. O círculo tem
// perímetro 100, então o valor é o comprimento do traço, e cada fatia começa onde a anterior acabou.
const SLICES = [
  { key: 'reportsHome', value: 38, start: 0, color: 'var(--color-category-1)' },
  { key: 'reportsFood', value: 24, start: 38, color: 'var(--color-category-3)' },
  { key: 'reportsTransport', value: 20, start: 62, color: 'var(--color-category-5)' },
  { key: 'reportsOther', value: 18, start: 82, color: 'var(--color-category-7)' },
] as const

// Recursos: a seção fica presa na tela e a trilha anda de lado com a rolagem (useLandingMotion).
// No celular ou com movimento reduzido (data-static), vira uma lista com rolagem lateral comum.
export function FeatureTour({ tourRef, trackRef }: { tourRef: RefObject<HTMLElement | null>; trackRef: RefObject<HTMLDivElement | null> }) {
  const { t } = useTranslation(['landing', 'common'])

  return (
    <section ref={tourRef} id="recursos" aria-labelledby="recursos-titulo" className="group relative">
      <div className="sticky top-0 flex h-dvh flex-col justify-center overflow-hidden group-data-static:static group-data-static:h-auto group-data-static:py-20">
        <div className="mx-auto mb-9 w-full max-w-[1212px] px-4">
          <h2 id="recursos-titulo" className="font-display text-[clamp(2rem,1.2rem+3vw,3.4rem)] leading-none font-[720] tracking-[-0.03em] text-balance [font-variation-settings:'wdth'_90]">
            {t('features.title')}
          </h2>
          <p className="mt-4 max-w-[46ch] text-lg text-muted">{t('features.intro')}</p>
        </div>

        <div
          ref={trackRef}
          role="group"
          aria-label={t('features.title')}
          className="flex items-start gap-6 px-[max(1rem,calc((100vw-1180px)/2))] will-change-transform group-data-static:snap-x group-data-static:snap-mandatory group-data-static:overflow-x-auto group-data-static:pb-4 focus-visible:outline-2 focus-visible:outline-primary"
        >
          <Panel width="sm:w-[29rem]" title={t('features.transactions')} text={t('features.transactionsText')}>
            <div className="mb-1.5 flex items-center gap-2 rounded-lg border border-border px-2.5 py-1.5 text-muted">
              <Icon name="search" className="size-3.5" />
              {t('features.transactionsSearch')}
            </div>
            <Row title={t('features.transactionsRow1')} sub={t('features.transactionsRow1Sub')} amount={formatOutflow(187.4)} kind="expense" />
            <Row title={t('features.transactionsRow2')} sub={t('features.transactionsRow2Sub')} amount={formatOutflow(312.9)} kind="expense" />
            <Row title={t('features.transactionsRow3')} sub={t('features.transactionsRow3Sub')} amount={formatSigned(45)} kind="income" />
          </Panel>

          <Panel width="sm:w-[25rem]" title={t('features.vaults')} text={t('features.vaultsText')}>
            <div className="flex items-start gap-3">
              <Mascot name="cofre-vazio" sizes="64px" lazy className="w-16 flex-none" />
              <div className="min-w-0 flex-1">
                <span className="font-semibold">{t('features.vaultsName')}</span>
                <span className="mt-0.5 block font-display text-2xl font-bold">{formatMoney(7250)}</span>
                <div className="mt-1.5 h-1.5 rounded-full bg-background">
                  <div className="h-full w-[72%] rounded-full bg-vault" />
                </div>
                <div className="mt-1 flex justify-between text-xs text-muted">
                  <span>{t('features.vaultsGoal', { goal: formatMoney(10000) })}</span>
                  <span>72%</span>
                </div>
              </div>
            </div>
          </Panel>

          <Panel width="sm:w-[25rem]" title={t('features.budgets')} text={t('features.budgetsText')}>
            <Budget name={t('features.budgetsFood')} note={t('features.budgetsFoodLeft', { amount: formatMoney(299.5) })} noteColor="text-muted" percent={62} barColor="bg-primary" />
            <Budget name={t('features.budgetsTransport')} note={t('features.budgetsTransportNear')} noteColor="text-vault-text" percent={95} barColor="bg-vault" />
            <Budget name={t('features.budgetsFun')} note={t('features.budgetsFunOver', { amount: formatMoney(10) })} noteColor="text-expense" percent={100} barColor="bg-expense" />
          </Panel>

          <Panel width="sm:w-[21rem]" title={t('features.recurring')} text={t('features.recurringText')}>
            <Row title={t('features.recurringRent')} sub={t('features.recurringRentEvery')} amount={formatOutflow(1500)} kind="expense" />
            <Row title={t('features.recurringFridge')} sub={t('features.recurringFridgeDate')} amount={formatOutflow(349.9)} kind="expense" />
          </Panel>

          <Panel width="sm:w-[25rem]" title={t('features.reports')} text={t('features.reportsText')}>
            <div className="flex items-center gap-4">
              <svg viewBox="0 0 42 42" className="size-28 flex-none -rotate-90">
                {SLICES.map((slice) => (
                  <circle
                    key={slice.key}
                    cx="21"
                    cy="21"
                    r="15.915"
                    fill="none"
                    stroke={slice.color}
                    strokeWidth="6"
                    strokeDasharray={`${slice.value} ${100 - slice.value}`}
                    strokeDashoffset={-slice.start}
                  />
                ))}
              </svg>
              <ul className="grid gap-1">
                {SLICES.map((slice) => (
                  <li key={slice.key} className="flex items-center gap-2">
                    <span className="size-2.5 flex-none rounded-sm" style={{ background: slice.color }} />
                    {t(`features.${slice.key}`)} {slice.value}%
                  </li>
                ))}
              </ul>
            </div>
          </Panel>

          <Panel width="sm:w-[21rem]" title={t('features.yours')} text={t('features.yoursText')}>
            <div className="flex flex-wrap gap-1.5">
              <Choice label={t('features.yoursLight')} />
              <Choice label={t('features.yoursDark')} on />
              <Choice label={t('features.yoursSystem')} />
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              <Choice label={LANGUAGE_SHORT_NAMES['pt-BR']} lang="pt-BR" on />
              <Choice label={LANGUAGE_SHORT_NAMES['en-US']} lang="en-US" />
            </div>
          </Panel>
        </div>
      </div>
    </section>
  )
}
