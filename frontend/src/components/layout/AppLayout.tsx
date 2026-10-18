import { startTransition } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, NavLink, Outlet, useNavigate } from 'react-router'
import { useAuth } from '../../auth/useAuth'
import { useRecurrenceSync } from '../../hooks/useRecurrences'
import { APP_NAME } from '../../config/app'
import { Button } from '../ui/Button'
import { Icon } from '../ui/Icon'
import { ThemeToggle } from '../ui/ThemeToggle'
import { NavIcon, Navigation } from './Navigation'

const LOGOUT_ICON = 'M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3M10 16l-4-4 4-4M6 12h10'

export function AppLayout() {
  const { t } = useTranslation('layout')
  const { user, signOut } = useAuth()
  const navigate = useNavigate()
  useRecurrenceSync()

  function handleSignOut() {
    // Na mesma transição da navegação: fora dela, a sessão apagada chegava antes à tela e a página
    // protegida mandava para o login.
    startTransition(() => {
      navigate('/', { replace: true })
      signOut()
    })
  }

  // O nome acessível começa pelo texto visível (WCAG 2.5.3).
  const brand = (
    <Link
      to="/"
      aria-label={t('homeLink')}
      className="rounded-lg text-xl font-bold tracking-tight text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
    >
      {APP_NAME}
    </Link>
  )

  function settingsLink(layout: string, showName: boolean) {
    return (
      <NavLink
        to="/configuracoes"
        aria-label={showName ? t('settingsLink', { name: user?.name ?? '' }) : undefined}
        title={showName ? user?.name : undefined}
        className={({ isActive }) =>
          `flex min-w-0 items-center gap-2 rounded-lg text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-primary ${layout} ${
            isActive ? 'bg-surface-soft/50 text-primary' : 'text-muted hover:bg-background hover:text-foreground'
          }`
        }
      >
        <Icon name="settings" />
        <span className="truncate">{showName ? user?.name : t('settings')}</span>
      </NavLink>
    )
  }

  return (
    <div className="min-h-dvh">
      <a
        href="#conteudo"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-surface focus:px-4 focus:py-2 focus:shadow"
      >
        {t('skipToContent')}
      </a>

      <aside className="fixed inset-y-0 left-0 hidden w-60 flex-col border-r border-border bg-surface md:flex">
        <div className="px-6 py-5">{brand}</div>
        <div className="flex-1 px-3">
          <Navigation variant="sidebar" />
        </div>
        <div className="border-t border-border p-3">
          <p className="truncate px-4 pb-1 pt-1.5 text-sm font-semibold text-foreground" title={user?.name}>
            {user?.name}
          </p>
          <div className="mb-1 flex items-center gap-1">
            <div className="min-w-0 flex-1">{settingsLink('px-4 py-2.5', false)}</div>
            <ThemeToggle />
          </div>
          <Button variant="ghost" className="w-full justify-start" onClick={handleSignOut}>
            <NavIcon path={LOGOUT_ICON} />
            {t('signOut')}
          </Button>
        </div>
      </aside>

      <header className="sticky top-0 z-10 flex h-14 items-center justify-between gap-3 border-b border-border bg-surface px-4 md:hidden">
        {brand}
        <div className="flex min-w-0 items-center gap-1">
          {settingsLink('min-h-11 px-2', true)}
          <ThemeToggle />
          <Button variant="ghost" className="px-2" onClick={handleSignOut}>
            <NavIcon path={LOGOUT_ICON} />
            {t('signOut')}
          </Button>
        </div>
      </header>

      <div className="md:pl-60">
        <main id="conteudo" className="mx-auto max-w-5xl px-4 pb-24 pt-6 md:px-8 md:pb-10 md:pt-10">
          <Outlet />
        </main>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-10 border-t border-border bg-surface px-2 pb-[env(safe-area-inset-bottom)] md:hidden">
        <Navigation variant="bar" />
      </div>
    </div>
  )
}
