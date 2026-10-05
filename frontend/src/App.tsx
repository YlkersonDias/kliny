import { Route, Routes } from 'react-router'
import { ProtectedRoute, PublicOnlyRoute } from './auth/ProtectedRoute'
import { AppLayout } from './components/layout/AppLayout'
import { useFocusOnRouteChange } from './hooks/useFocusOnRouteChange'
import DashboardPage from './pages/DashboardPage'
import LoginPage from './pages/LoginPage'
import NotFoundPage from './pages/NotFoundPage'
import RegisterPage from './pages/RegisterPage'
import ReportsPage from './pages/ReportsPage'
import TransactionsPage from './pages/TransactionsPage'
import VaultDetailPage from './pages/VaultDetailPage'
import VaultsPage from './pages/VaultsPage'

export default function App() {
  useFocusOnRouteChange()

  return (
    <Routes>
      <Route element={<PublicOnlyRoute />}>
        <Route path="/entrar" element={<LoginPage />} />
        <Route path="/cadastro" element={<RegisterPage />} />
      </Route>

      <Route element={<ProtectedRoute />}>
        <Route element={<AppLayout />}>
          <Route index element={<DashboardPage />} />
          <Route path="/movimentacoes" element={<TransactionsPage />} />
          <Route path="/cofres" element={<VaultsPage />} />
          <Route path="/cofres/:id" element={<VaultDetailPage />} />
          <Route path="/relatorios" element={<ReportsPage />} />
        </Route>
      </Route>

      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  )
}
