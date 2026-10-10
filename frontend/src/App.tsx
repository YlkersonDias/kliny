import { Route, Routes } from 'react-router'
import { ProtectedRoute, PublicOnlyRoute } from './auth/ProtectedRoute'
import { AppLayout } from './components/layout/AppLayout'
import { useFocusOnRouteChange } from './hooks/useFocusOnRouteChange'
import CreateAccountPage from './pages/CreateAccountPage'
import DashboardPage from './pages/DashboardPage'
import ForgotPasswordPage from './pages/ForgotPasswordPage'
import ImportPage from './pages/ImportPage'
import LoginPage from './pages/LoginPage'
import NotFoundPage from './pages/NotFoundPage'
import PrivacyPage from './pages/PrivacyPage'
import RegisterPage from './pages/RegisterPage'
import ReportsPage from './pages/ReportsPage'
import ResetPasswordPage from './pages/ResetPasswordPage'
import SettingsPage from './pages/SettingsPage'
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
          <Route path="/movimentacoes/importar" element={<ImportPage />} />
          <Route path="/cofres" element={<VaultsPage />} />
          <Route path="/cofres/:id" element={<VaultDetailPage />} />
          <Route path="/relatorios" element={<ReportsPage />} />
          <Route path="/configuracoes" element={<SettingsPage />} />
        </Route>
      </Route>

      {/* Públicas, com e sem login. A troca de senha pelo link do e-mail também abre logado. */}
      <Route path="/privacidade" element={<PrivacyPage />} />
      <Route path="/esqueci-senha" element={<ForgotPasswordPage />} />
      <Route path="/redefinir-senha" element={<ResetPasswordPage />} />
      <Route path="/criar-conta" element={<CreateAccountPage />} />

      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  )
}
