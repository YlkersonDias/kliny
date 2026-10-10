import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { APP_NAME } from '../../config/app'
import { LanguageSwitch } from '../ui/LanguageSwitch'
import { ThemeToggle } from '../ui/ThemeToggle'

const navLink = 'rounded-full px-3.5 py-2 text-sm font-medium text-muted transition-colors duration-200 hover:bg-background hover:text-foreground focus-visible:outline-2 focus-visible:outline-primary'

// Menu fixo em pílula, translúcido. No celular, só a marca, tema, idioma e os dois botões de conta.
export function LandingHeader() {
  const { t } = useTranslation(['landing', 'layout'])

  return (
    <header className="pointer-events-none fixed inset-x-0 top-3 z-20 flex justify-center px-4 sm:top-4">
      <nav
        aria-label={t('nav.label')}
        className="pointer-events-auto flex w-full max-w-[1180px] items-center gap-1 rounded-full border border-border bg-surface/75 py-1.5 pr-1.5 pl-4 backdrop-blur-md backdrop-saturate-150"
      >
        <Link
          to="/"
          aria-label={t('layout:homeLink')}
          className="mr-auto rounded-lg py-1.5 font-display text-xl font-bold tracking-tight text-primary focus-visible:outline-2 focus-visible:outline-primary"
        >
          {APP_NAME}
        </Link>
        <a href="#recursos" className={`hidden md:inline-block ${navLink}`}>{t('nav.features')}</a>
        <a href="#privacidade" className={`hidden md:inline-block ${navLink}`}>{t('nav.privacy')}</a>
        <LanguageSwitch className="hover:bg-background" />
        <ThemeToggle />
        <Link to="/entrar" className={`hidden sm:inline-block ${navLink}`}>{t('nav.signIn')}</Link>
        <Link
          to="/cadastro"
          className="rounded-full bg-primary px-4 py-2.5 text-sm font-semibold whitespace-nowrap text-on-primary transition-colors duration-200 hover:bg-primary-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          {t('nav.signUp')}
        </Link>
      </nav>
    </header>
  )
}
