import { Navigate, Outlet, useLocation, type Location } from 'react-router'
import { FullPageSpinner } from '../components/ui/Spinner'
import { useAuth } from './useAuth'

export interface RedirectState {
  from?: Location
}

// Páginas que exigem login. Quem está deslogado vai para /entrar e depois volta para cá.
export function ProtectedRoute() {
  const { user, isValidating } = useAuth()
  const location = useLocation()

  if (isValidating) return <FullPageSpinner />
  if (user === null) {
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
