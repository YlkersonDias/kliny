import type { ReactNode, RefObject } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { formatMoney, formatOutflow, formatSigned } from '../../lib/money'
import { Icon } from '../ui/Icon'
import { Mascot } from './Mascot'

// A flutuação fica num filho, para o parallax (translate) e a flutuação (transform) não se anularem.
function Stash({ position, float, parallax, children }: { position: string; float: string; parallax: number; children: ReactNode }) {
  return (
    <div className={`absolute ${position}`} data-parallax={parallax}>
      <div className={float}>
        <div className="rounded-2xl border border-border bg-surface px-3 py-2.5 text-xs text-foreground shadow-lg shadow-primary/15 min-[860px]:px-4 min-[860px]:py-3 min-[860px]:text-sm">
          {children}
        </div>
      </div>
    </div>
  )
}

function Bar({ percent }: { percent: number }) {
  return (
    <div className="mt-1.5 h-1.5 rounded-full bg-background">
      <div className="h-full rounded-full bg-vault" style={{ width: `${percent}%` }} />
    </div>
  )
}

function Entry({ kind, title, sub, amount }: { kind: 'income' | 'expense'; title: string; sub: ReactNode; amount: string }) {
  const color = kind === 'income' ? 'text-income' : 'text-expense'
  return (
    <div className="flex items-center gap-2.5 whitespace-nowrap">
      <span className={`flex size-8 items-center justify-center rounded-full bg-background ${color}`}>
        <Icon name={kind} className="size-4" />
      </span>
      <span>
        <span className="block font-semibold">{title}</span>
        <span className="flex items-center gap-1 text-[0.8em] text-muted">{sub}</span>
      </span>
      <span className={`ml-2 font-semibold tabular-nums ${color}`}>{amount}</span>
    </div>
  )
}

// Os cartões são exemplos visuais (aria-hidden): o texto da abertura já diz o que o app faz.
export function HeroSection({ stageRef }: { stageRef: RefObject<HTMLDivElement | null> }) {
  const { t } = useTranslation('landing')

  return (
    <section className="pt-28 pb-16 min-[860px]:pt-36 min-[860px]:pb-20">
      <div className="mx-auto grid w-full max-w-[1212px] items-center gap-8 px-4 min-[860px]:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]">
        <div>
          <h1 className="landing-rise font-display text-[clamp(2.9rem,1.4rem+5.6vw,5.6rem)] leading-[0.95] font-[760] tracking-[-0.035em] text-balance [animation-delay:100ms] [font-variation-settings:'wdth'_88]">
            {t('hero.title')}
          </h1>
          <p className="landing-rise mt-6 max-w-[34ch] text-lg text-pretty text-muted [animation-delay:400ms] min-[860px]:text-xl">
            {t('hero.lead')}
          </p>
          <div className="landing-rise mt-8 flex flex-wrap items-center gap-3 [animation-delay:700ms]">
            <Link
              to="/cadastro"
              className="inline-flex min-h-13 items-center rounded-full bg-primary px-6 font-semibold text-on-primary transition-colors duration-200 hover:bg-primary-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              {t('hero.primary')}
            </Link>
            <Link
              to="/entrar"
              className="inline-flex min-h-13 items-center rounded-full border border-foreground/30 px-6 font-semibold text-foreground transition-colors duration-200 hover:bg-surface focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              {t('hero.secondary')}
            </Link>
          </div>
          <p className="landing-rise mt-4 text-sm text-muted [animation-delay:700ms]">{t('hero.note')}</p>
        </div>

        <div
          ref={stageRef}
          aria-hidden="true"
          className="landing-rise relative mx-auto aspect-square w-full max-w-[440px] [animation-delay:1300ms] min-[860px]:mr-0 min-[860px]:max-w-[560px]"
        >
          <div className="absolute inset-[6%] overflow-hidden rounded-full bg-burrow">
            <div className="absolute inset-x-[12%] bottom-0 h-[38%] rounded-t-full bg-primary-hover/20" />
          </div>
          <div className="absolute -inset-[0.5%] rounded-full border-2 border-dashed border-burrow/55" />
          <div className="absolute bottom-[19%] left-[18%] w-[64%]" data-parallax={-0.06}>
            <Mascot name="calculadora" large sizes="(max-width: 859px) 70vw, 360px" className="w-full drop-shadow-xl" />
          </div>

          <Stash position="-left-[3%] top-[2%] min-[481px]:-left-[2%] min-[481px]:top-[8%] min-[860px]:-left-[6%] min-[860px]:top-[14%]" float="landing-float-a" parallax={0.12}>
            <Entry kind="income" title={t('stash.salary')} sub={t('stash.salaryDate')} amount={formatSigned(4200)} />
          </Stash>
          <Stash position="-right-[3%] top-[58%] min-[481px]:top-0 min-[481px]:-right-[2%] min-[860px]:top-[4%] min-[860px]:right-0" float="landing-float-b" parallax={0.2}>
            <div className="min-w-44 min-[860px]:min-w-52">
              <div className="flex justify-between gap-3">
                <span className="font-semibold">{t('stash.vault')}</span>
                <span className="font-semibold text-vault-text">62%</span>
              </div>
              <span className="text-[0.8em] text-muted">{t('stash.vaultOf', { saved: formatMoney(1860), goal: formatMoney(3000) })}</span>
              <Bar percent={62} />
            </div>
          </Stash>
          <Stash position="-left-[3%] bottom-[2%] min-[481px]:left-auto min-[481px]:-right-[3%] min-[481px]:bottom-0 min-[860px]:-right-[6%] min-[860px]:bottom-[5%]" float="landing-float-c" parallax={0.08}>
            <Entry
              kind="expense"
              title={t('stash.rent')}
              sub={<><Icon name="repeat" className="size-3" />{t('stash.rentEvery')}</>}
              amount={formatOutflow(1500)}
            />
          </Stash>
          <Stash position="hidden min-[481px]:block -left-[3%] bottom-[17%] min-[860px]:-left-[4%] min-[860px]:bottom-[13%]" float="landing-float-d" parallax={0.16}>
            <div className="min-w-44 min-[860px]:min-w-56">
              <div className="flex justify-between gap-3">
                <span className="font-semibold">{t('stash.market')}</span>
                <span className="text-[0.8em] text-muted">{t('stash.thisMonth')}</span>
              </div>
              <span className="text-[0.8em] text-muted">{t('stash.marketOf', { spent: formatMoney(640), limit: formatMoney(800) })}</span>
              <Bar percent={80} />
            </div>
          </Stash>
        </div>
      </div>
    </section>
  )
}
