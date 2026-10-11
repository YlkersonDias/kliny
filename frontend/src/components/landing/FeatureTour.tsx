import type { ReactNode, RefObject } from 'react'
import { useTranslation } from 'react-i18next'
import { LANGUAGE_SHORT_NAMES } from '../../lib/language'
import { formatMoney, formatOutflow, formatSigned } from '../../lib/money'
import { simulate } from '../../lib/simulator'
import { Icon } from '../ui/Icon'

// Todos os cartões com a mesma largura e a mesma altura (a do mais alto, pela trilha): a descrição
// reserva três linhas, e o exemplo ocupa o resto, com o conteúdo centralizado.
function Panel({ title, text, children }: { title: string; text: string; children: ReactNode }) {
  return (
    <article className="flex w-[min(84vw,24rem)] flex-none snap-center flex-col gap-5 rounded-3xl border border-border bg-surface p-6 shadow-lg shadow-primary/10">
      <div>
        <h3 className="font-display text-2xl leading-tight font-[680] tracking-[-0.02em]">{title}</h3>
        <p className="mt-1.5 min-h-[3lh] text-[0.95rem] text-muted">{text}</p>
      </div>
      {/* Exemplo visual de uma tela do app; o título e o texto acima já dizem o que ela faz. */}
      <div aria-hidden="true" className="flex flex-1 flex-col justify-center rounded-2xl border border-border p-3.5 text-sm">{children}</div>
    </article>
  )
}

function Row({ title, sub, amount, kind, mark }: {
  title: string
  sub: string
  amount: string
  kind: 'income' | 'expense'
  mark?: 'repeat' | 'card'
}) {
  return (
    <div className="flex items-center gap-3 border-border px-1 py-2 not-first:border-t">
      <span className="min-w-0 flex-1 truncate">
        <span className="flex items-center gap-1.5">
          {title}
          {mark && <Icon name={mark} className="size-3.5 text-muted" />}
        </span>
        <span className="block text-xs text-muted">{sub}</span>
      </span>
      <span className={`font-semibold tabular-nums ${kind === 'income' ? 'text-income' : 'text-expense'}`}>{amount}</span>
    </div>
  )
}

// Cofre com a barra da meta: âmbar até atingir e verde quando atinge, como no app.
function Vault({ name, detail, percent, reached = false }: { name: string; detail: string; percent: number; reached?: boolean }) {
  return (
    <div className="px-1 py-1.5">
      <div className="flex justify-between gap-2">
        <span className="font-semibold">{name}</span>
        <span className={`text-xs font-semibold ${reached ? 'text-income' : 'text-vault-text'}`}>{percent}%</span>
      </div>
      <span className="text-xs text-muted">{detail}</span>
      <div className="mt-1 h-1.5 rounded-full bg-background">
        <div className={`h-full rounded-full ${reached ? 'bg-income' : 'bg-vault'}`} style={{ width: `${percent}%` }} />
      </div>
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

// Exemplo do simulador, calculado com a mesma conta do app: R$ 500 por mês, 0,8% ao mês, 10 anos.
// A taxa é só de exemplo: no app, quem informa é a pessoa.
const SIMULATION = simulate({ initial: 0, monthly: 500, rate: 0.8, rateUnit: 'month', months: 120 })
const SIMULATION_TOTAL = SIMULATION.ok ? SIMULATION.total : 0
const SIMULATION_CONTRIBUTED = SIMULATION.ok ? SIMULATION.contributed : 0
// Pontos do gráfico (um por ano) numa caixa de 100 x 40, com o total mais alto no topo.
const SIMULATION_LINES = SIMULATION.ok
  ? (['total', 'contributed'] as const).map((key) => SIMULATION.points
    .map((point, index) => `${(index / (SIMULATION.points.length - 1)) * 100},${40 - (point[key] / SIMULATION_TOTAL) * 36}`)
    .join(' '))
  : ['', '']

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
          className="flex items-stretch gap-6 px-[max(1rem,calc((100vw-1180px)/2))] will-change-transform group-data-static:snap-x group-data-static:snap-mandatory group-data-static:overflow-x-auto group-data-static:pb-4 focus-visible:outline-2 focus-visible:outline-primary"
        >
          <Panel title={t('features.transactions')} text={t('features.transactionsText')}>
            <div className="mb-1.5 flex items-center gap-2 rounded-lg border border-border px-2.5 py-1.5 text-muted">
              <Icon name="search" className="size-3.5" />
              {t('features.transactionsSearch')}
            </div>
            <div className="mb-1 flex gap-1.5 text-xs">
              <Choice label={t('features.transactionsFilterMonth')} on />
              <Choice label={t('features.transactionsFilterExpense')} />
            </div>
            <Row title={t('features.transactionsRow1')} sub={t('features.transactionsRow1Sub')} amount={formatOutflow(187.4)} kind="expense" />
            <Row title={t('features.transactionsRow2')} sub={t('features.transactionsRow2Sub')} amount={formatOutflow(312.9)} kind="expense" />
            <Row title={t('features.transactionsRow3')} sub={t('features.transactionsRow3Sub')} amount={formatSigned(45)} kind="income" />
          </Panel>

          <Panel title={t('features.vaults')} text={t('features.vaultsText')}>
            <Vault name={t('features.vaultsName')} detail={t('features.vaultsOf', { saved: formatMoney(7250), goal: formatMoney(10000) })} percent={72} />
            <Vault name={t('features.vaultsTrip')} detail={t('features.vaultsOf', { saved: formatMoney(1860), goal: formatMoney(3000) })} percent={62} />
            <Vault name={t('features.vaultsGift')} detail={t('features.vaultsReached')} percent={100} reached />
          </Panel>

          <Panel title={t('features.budgets')} text={t('features.budgetsText')}>
            <Budget name={t('features.budgetsFood')} note={t('features.budgetsFoodLeft', { amount: formatMoney(299.5) })} noteColor="text-muted" percent={62} barColor="bg-primary" />
            <Budget name={t('features.budgetsHome')} note={t('features.budgetsHomeReached')} noteColor="text-muted" percent={100} barColor="bg-primary" />
            <Budget name={t('features.budgetsTransport')} note={t('features.budgetsTransportNear')} noteColor="text-vault-text" percent={95} barColor="bg-vault" />
            <Budget name={t('features.budgetsFun')} note={t('features.budgetsFunOver', { amount: formatMoney(10) })} noteColor="text-expense" percent={100} barColor="bg-expense" />
          </Panel>

          <Panel title={t('features.recurring')} text={t('features.recurringText')}>
            <Row title={t('features.recurringSalary')} sub={t('features.recurringSalaryEvery')} amount={formatSigned(4200)} kind="income" mark="repeat" />
            <Row title={t('features.recurringRent')} sub={t('features.recurringRentEvery')} amount={formatOutflow(1500)} kind="expense" mark="repeat" />
            <Row title={t('features.recurringStreaming')} sub={t('features.recurringStreamingEvery')} amount={formatOutflow(39.9)} kind="expense" mark="repeat" />
            <Row title={t('features.recurringFridge')} sub={t('features.recurringFridgeDate')} amount={formatOutflow(349.9)} kind="expense" mark="card" />
          </Panel>

          <Panel title={t('features.reports')} text={t('features.reportsText')}>
            <div className="flex items-center gap-4">
              <svg viewBox="0 0 42 42" className="size-24 flex-none -rotate-90">
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
            <dl className="mt-3 grid grid-cols-3 gap-2 border-t border-border pt-3 text-xs">
              <div><dt className="text-muted">{t('features.reportsIn')}</dt><dd className="font-semibold text-income tabular-nums">{formatSigned(5200)}</dd></div>
              <div><dt className="text-muted">{t('features.reportsOut')}</dt><dd className="font-semibold text-expense tabular-nums">{formatOutflow(3480)}</dd></div>
              <div><dt className="text-muted">{t('features.reportsLeft')}</dt><dd className="font-semibold tabular-nums">{formatSigned(1720)}</dd></div>
            </dl>
          </Panel>

          <Panel title={t('features.simulator')} text={t('features.simulatorText')}>
            <dl className="grid grid-cols-3 gap-2 text-xs">
              <div><dt className="text-muted">{t('features.simulatorMonthly')}</dt><dd className="font-semibold tabular-nums">{formatMoney(500)}</dd></div>
              <div><dt className="text-muted">{t('features.simulatorRate')}</dt><dd className="font-semibold tabular-nums">{t('features.simulatorRateValue')}</dd></div>
              <div><dt className="text-muted">{t('features.simulatorTerm')}</dt><dd className="font-semibold">{t('features.simulatorTermValue')}</dd></div>
            </dl>
            <svg viewBox="0 0 100 40" preserveAspectRatio="none" className="mt-3 h-20 w-full">
              <polygon points={`0,40 ${SIMULATION_LINES[0]} 100,40`} fill="var(--color-primary)" fillOpacity="0.3" />
              <polyline points={SIMULATION_LINES[0]} fill="none" stroke="var(--color-primary)" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
              <polygon points={`0,40 ${SIMULATION_LINES[1]} 100,40`} fill="var(--color-vault)" fillOpacity="0.5" />
              <polyline points={SIMULATION_LINES[1]} fill="none" stroke="var(--color-vault)" strokeWidth="1.5" strokeDasharray="4 3" vectorEffect="non-scaling-stroke" />
            </svg>
            <dl className="mt-3 grid grid-cols-2 gap-2 border-t border-border pt-3 text-xs">
              <div><dt className="flex items-center gap-1.5 text-muted"><span className="size-2.5 rounded-sm bg-vault" />{t('features.simulatorContributed')}</dt><dd className="font-semibold tabular-nums">{formatMoney(SIMULATION_CONTRIBUTED)}</dd></div>
              <div><dt className="flex items-center gap-1.5 text-muted"><span className="size-2.5 rounded-sm bg-primary" />{t('features.simulatorTotal')}</dt><dd className="font-semibold text-primary tabular-nums">{formatMoney(SIMULATION_TOTAL)}</dd></div>
            </dl>
          </Panel>

          <Panel title={t('features.yours')} text={t('features.yoursText')}>
            <span className="mb-1.5 block text-xs text-muted">{t('features.yoursTheme')}</span>
            <div className="flex flex-wrap gap-1.5">
              <Choice label={t('features.yoursLight')} />
              <Choice label={t('features.yoursDark')} on />
              <Choice label={t('features.yoursSystem')} />
            </div>
            <span className="mt-3 mb-1.5 block text-xs text-muted">{t('features.yoursLanguage')}</span>
            <div className="flex flex-wrap gap-1.5">
              <Choice label={LANGUAGE_SHORT_NAMES['pt-BR']} lang="pt-BR" on />
              <Choice label={LANGUAGE_SHORT_NAMES['en-US']} lang="en-US" />
            </div>
            <div className="mt-3 flex items-center gap-2.5 border-t border-border pt-3">
              <span className="flex size-8 flex-none items-center justify-center rounded-full bg-background text-primary">
                <Icon name="phone" className="size-4" />
              </span>
              <span>
                <span className="block font-semibold">{t('features.yoursInstall')}</span>
                <span className="block text-xs text-muted">{t('features.yoursInstallHint')}</span>
              </span>
            </div>
          </Panel>
        </div>
      </div>
    </section>
  )
}
