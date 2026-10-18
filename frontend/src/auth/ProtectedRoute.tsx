import { lazy, Suspense } from 'react'
import { Navigate, Outlet, useLocation, type Location } from 'react-router'
import { FullPageSpinner } from '../components/ui/Spinner'
import { useAuth } from './useAuth'

// Só carregada quando alguém sem sessão abre "/".
const LandingPage = lazy(() => import('../pages/LandingPage'))

export interface RedirectState {
  from?: Location
}

// Quem está deslogado vai para /entrar e depois volta; em "/", vê a landing.
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
