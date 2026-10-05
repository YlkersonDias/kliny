import { Link, Outlet, useNavigate } from 'react-router'
import { useAuth } from '../../auth/useAuth'
import { APP_NAME } from '../../config/app'
import { Button } from '../ui/Button'
import { NavIcon, Navigation } from './Navigation'

const LOGOUT_ICON = 'M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3M10 16l-4-4 4-4M6 12h10'

export function AppLayout() {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()

  function handleSignOut() {
    signOut()
    // Sem guardar a página atual: o próximo login pode ser de outra pessoa.
    navigate('/entrar', { replace: true })
  }

  // Marca clicável, levando ao início (no menu lateral e no cabeçalho do celular). O nome
  // acessível começa pelo texto visível, como pede o WCAG 2.5.3.
  const brand = (
    <Link
      to="/"
      aria-label={`${APP_NAME}, página inicial`}
      className="rounded-lg text-xl font-bold tracking-tight text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
    >
      {APP_NAME}
    </Link>
  )

  return (
    <div className="min-h-dvh">
      <a
        href="#conteudo"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-surface focus:px-4 focus:py-2 focus:shadow"
      >
        Pular para o conteúdo
      </a>

      {/* Desktop: menu lateral */}
      <aside className="fixed inset-y-0 left-0 hidden w-60 flex-col border-r border-border bg-surface md:flex">
        <div className="px-6 py-5">{brand}</div>
        <div className="flex-1 px-3">
          <Navigation variant="sidebar" />
        </div>
        <div className="border-t border-border p-3">
          <p className="truncate px-3 pb-2 text-sm text-muted" title={user?.name}>{user?.name}</p>
          <Button variant="ghost" className="w-full justify-start" onClick={handleSignOut}>
            <NavIcon path={LOGOUT_ICON} />
            Sair
          </Button>
        </div>
      </aside>

      {/* Celular: cabeçalho no topo e menu na barra inferior */}
      <header className="sticky top-0 z-10 flex h-14 items-center justify-between gap-3 border-b border-border bg-surface px-4 md:hidden">
        {brand}
        <div className="flex min-w-0 items-center gap-1">
          <span className="truncate text-sm text-muted">{user?.name}</span>
          <Button variant="ghost" className="px-2" onClick={handleSignOut}>
            <NavIcon path={LOGOUT_ICON} />
            Sair
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
