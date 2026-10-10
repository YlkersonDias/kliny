import { lazy, Suspense } from 'react'
import { Navigate, Outlet, useLocation, type Location } from 'react-router'
import { FullPageSpinner } from '../components/ui/Spinner'
import { useAuth } from './useAuth'

// A landing (8.6) é carregada só quando alguém sem sessão abre "/": quem está logado não a baixa.
const LandingPage = lazy(() => import('../pages/LandingPage'))

export interface RedirectState {
  from?: Location
}

// Páginas que exigem login. Quem está deslogado vai para /entrar e depois volta para cá; em "/",
// vê a landing (o Dashboard, com sessão, continua no mesmo endereço e no mesmo AppLayout).
export function ProtectedRoute() {
  const { user, isValidating } = useAuth()
  const location = useLocation()

  if (isValidating) return <FullPageSpinner />
  if (user === null) {
    if (location.pathname === '/') {
      return (
        <Suspense fallback={<FullPageSpinner />}>
          <LandingPage />
        </Suspense>
      )
    }
    return <Navigate to="/entrar" replace state={{ from: location } satisfies RedirectState} />
  }
  return <Outlet />
}

// Login e cadastro. Quem já está logado vai para a página que tentou abrir, ou para o início.
export function PublicOnlyRoute() {
  const { user, isValidating } = useAuth()
  const location = useLocation()

  if (isValidating) return <FullPageSpinner />
  if (user !== null) {
    const from = (location.state as RedirectState | null)?.from
    const target = from ? `${from.pathname}${from.search}${from.hash}` : '/'
    return <Navigate to={target} replace />
  }
  return <Outlet />
}
