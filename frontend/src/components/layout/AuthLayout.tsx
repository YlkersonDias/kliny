import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { APP_NAME } from '../../config/app'
import { LanguageSwitch } from '../ui/LanguageSwitch'
import { ThemeToggle } from '../ui/ThemeToggle'

interface AuthLayoutProps {
  title: string
  subtitle: string
  mascot?: boolean
  children: ReactNode
}

export function AuthLayout({ title, subtitle, mascot = false, children }: AuthLayoutProps) {
  const { t } = useTranslation('privacy')

  return (
    <div className="relative flex min-h-dvh flex-col items-center justify-center bg-surface-soft px-4 py-10">
      <div className="absolute right-3 top-3 flex items-center gap-1">
        <LanguageSwitch />
        <ThemeToggle onSoft />
      </div>
      <div className="w-full max-w-sm">
        {/* O mascote fica fora do fluxo: a margem (relativa à largura do cartão) reserva o espaço dele. */}
        <main className={`relative rounded-2xl bg-surface p-6 shadow-lg shadow-primary/10 sm:p-8 ${mascot ? 'mt-[46.3%]' : ''}`}>
          {mascot && (
            <img
              src="/mascote/kliny-login-mascote.png"
              srcSet="/mascote/kliny-login-mascote.png 1x, /mascote/kliny-login-mascote@2x.png 2x"
              width={440}
              height={239}
              alt=""
              draggable={false}
              className="pointer-events-none absolute bottom-full left-[4.2%] z-10 -mb-[3.54%] h-auto w-[91.7%] select-none"
            />
          )}
          <p className="text-2xl font-bold tracking-tight text-primary">{APP_NAME}</p>
          <h1 className="mt-6 text-xl font-semibold text-foreground">{title}</h1>
          <p className="mt-1 text-sm text-muted">{subtitle}</p>
          <div className="mt-6">{children}</div>
        </main>
        {/* Sobre o lilás só o foreground passa de 4,5:1. */}
        <p className="mt-4 text-center text-sm">
          <Link to="/privacidade" className="text-foreground underline underline-offset-2">
            {t('footerLink')}
          </Link>
        </p>
      </div>
    </div>
  )
}
