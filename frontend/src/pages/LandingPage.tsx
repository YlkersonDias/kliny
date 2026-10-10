import { useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { FeatureTour } from '../components/landing/FeatureTour'
import { HeroSection } from '../components/landing/HeroSection'
import { LandingHeader } from '../components/landing/LandingHeader'
import { Mascot } from '../components/landing/Mascot'
import { Icon } from '../components/ui/Icon'
import { APP_NAME } from '../config/app'
import { useLandingMotion } from '../hooks/useLandingMotion'
import { usePageTitle } from '../hooks/usePageTitle'

const titleStyle = "font-display leading-none font-[720] tracking-[-0.03em] text-balance [font-variation-settings:'wdth'_90]"
const sectionTitle = `${titleStyle} text-[clamp(2rem,1.2rem+3vw,3.4rem)]`
// A privacidade é a frase mais forte da página depois da abertura: título maior.
const privacyTitle = `${titleStyle} text-[clamp(2.2rem,1.2rem+3.6vw,4rem)]`
const primaryButton = 'inline-flex min-h-13 items-center rounded-full bg-primary px-6 font-semibold text-on-primary transition-colors duration-200 hover:bg-primary-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary'
const ghostButton = 'inline-flex min-h-13 items-center rounded-full border border-foreground/30 px-6 font-semibold text-foreground transition-colors duration-200 hover:bg-surface focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary'
const footerLink = 'rounded hover:text-foreground hover:underline focus-visible:outline-2 focus-visible:outline-primary'

const PROMISES = [
  { icon: 'wallet', title: 'promises.free', text: 'promises.freeText' },
  { icon: 'shield', title: 'promises.yours', text: 'promises.yoursText' },
  { icon: 'phone', title: 'promises.devices', text: 'promises.devicesText' },
  { icon: 'moon', title: 'promises.theme', text: 'promises.themeText' },
] as const

// Uma sequência de verdade: por isso os números.
const STEPS = [
  { title: 'steps.account', text: 'steps.accountText' },
  { title: 'steps.balance', text: 'steps.balanceText' },
  { title: 'steps.vault', text: 'steps.vaultText' },
] as const

const FACTS = [
  { title: 'privacy.bank', text: 'privacy.bankText' },
  { title: 'privacy.ai', text: 'privacy.aiText' },
  { title: 'privacy.delete', text: 'privacy.deleteText' },
] as const

// Landing (8.6): o que quem ainda não tem conta vê em "/". Carregada sob demanda (App.tsx), então
// quem está logado não baixa nada daqui.
export default function LandingPage() {
  const { t } = useTranslation(['landing', 'layout'])
  usePageTitle(t('pageTitle'))
  const stageRef = useRef<HTMLDivElement>(null)
  const tourRef = useRef<HTMLElement>(null)
  const trackRef = useRef<HTMLDivElement>(null)
  useLandingMotion({ stage: stageRef, tour: tourRef, track: trackRef })

  return (
    <div className="min-h-dvh overflow-x-clip">
      <a
        href="#conteudo"
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-50 focus:rounded-lg focus:bg-surface focus:px-4 focus:py-2 focus:shadow"
      >
        {t('layout:skipToContent')}
      </a>
      <LandingHeader />

      <main id="conteudo" tabIndex={-1}>
        <HeroSection stageRef={stageRef} />

        <section aria-label={t('promises.label')} className="border-y border-border">
          <ul className="mx-auto grid w-full max-w-[1212px] gap-6 px-4 py-6 sm:grid-cols-2 lg:grid-cols-4">
            {PROMISES.map((promise) => (
              <li key={promise.title} className="flex items-start gap-3 text-[0.95rem] text-muted">
                <Icon name={promise.icon} className="mt-0.5 size-5 text-primary" />
                <span>
                  <strong className="block font-semibold text-foreground">{t(promise.title)}</strong>
                  {t(promise.text)}
                </span>
              </li>
            ))}
          </ul>
        </section>

        <FeatureTour tourRef={tourRef} trackRef={trackRef} />

        <section aria-labelledby="comecar-titulo" className="py-20 md:py-26">
          <div className="mx-auto w-full max-w-[1212px] px-4">
            <h2 id="comecar-titulo" className={sectionTitle}>{t('steps.title')}</h2>
            <p className="mt-4 max-w-[46ch] text-lg text-muted">{t('steps.intro')}</p>
            <ol className="mt-12 grid gap-8 md:grid-cols-3">
              {STEPS.map((step, index) => (
                <li key={step.title} className="border-t-2 border-border pt-5">
                  <span aria-hidden="true" className="mb-3.5 block font-display text-5xl leading-none font-bold text-primary">{index + 1}</span>
                  <h3 className="font-display text-xl font-semibold">{t(step.title)}</h3>
                  <p className="mt-1.5 text-muted">{t(step.text)}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section id="privacidade" aria-labelledby="privacidade-titulo" className="border-y border-border bg-surface py-20 md:py-26">
          <div className="mx-auto grid w-full max-w-[1212px] gap-10 px-4 min-[860px]:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
            <div>
              <h2 id="privacidade-titulo" className={privacyTitle}>{t('privacy.title')}</h2>
              <p className="mt-4 max-w-[46ch] text-lg text-muted">{t('privacy.intro', { appName: APP_NAME })}</p>
              <Mascot name="cadeado" large lazy sizes="18rem" className="mx-auto mt-8 w-52 min-[860px]:mx-0 min-[860px]:w-72" />
            </div>
            <ul className="grid content-start gap-6">
              {FACTS.map((fact) => (
                <li key={fact.title} className="relative pl-6">
                  <span aria-hidden="true" className="absolute top-2 left-0 size-2.5 rounded-full bg-vault" />
                  <strong className="block font-semibold">{t(fact.title)}</strong>
                  <span className="text-muted">{t(fact.text)}</span>
                </li>
              ))}
              <li className="pl-6">
                <Link to="/privacidade" className="rounded font-semibold text-primary underline underline-offset-2 focus-visible:outline-2 focus-visible:outline-primary">
                  {t('privacy.policy')}
                </Link>
              </li>
            </ul>
          </div>
        </section>

        <section aria-labelledby="final-titulo" className="px-4 py-20 text-center md:py-26">
          <Mascot name="meta-atingida" lazy sizes="13rem" className="mx-auto mb-4 w-52" />
          <h2 id="final-titulo" className={`${sectionTitle} mx-auto max-w-[16ch]`}>{t('final.title')}</h2>
          <p className="mx-auto mt-4 max-w-[46ch] text-lg text-muted">{t('final.intro')}</p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link to="/cadastro" className={primaryButton}>{t('final.primary')}</Link>
            <Link to="/entrar" className={ghostButton}>{t('final.secondary')}</Link>
          </div>
        </section>
      </main>

      <footer className="border-t border-border py-8 text-sm text-muted">
        <nav aria-label={t('footer.label')} className="mx-auto flex w-full max-w-[1212px] flex-wrap items-center gap-x-8 gap-y-3 px-4">
          <span className="mr-auto font-display text-lg font-bold text-primary">{APP_NAME}</span>
          <Link to="/privacidade" className={footerLink}>{t('footer.privacy')}</Link>
          <Link to="/entrar" className={footerLink}>{t('footer.signIn')}</Link>
          <Link to="/cadastro" className={footerLink}>{t('footer.signUp')}</Link>
        </nav>
      </footer>
    </div>
  )
}
