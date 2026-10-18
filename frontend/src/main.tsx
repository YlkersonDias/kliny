import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import './i18n'
import { ApiError } from './api/client'
import { AuthProvider } from './auth/AuthProvider'
import { LanguageProvider } from './language/LanguageProvider'
import { ThemeProvider } from './theme/ThemeProvider'
import App from './App.tsx'
import { UpdatePrompt } from './components/ui/UpdatePrompt'
import './index.css'

// Sem rede, o padrão do TanStack Query pausa a requisição em silêncio; com 'always', ela falha
// na hora e a tela mostra o erro.
const queryClient = new QueryClient({
  defaultOptions: {
    mutations: {
      networkMode: 'always',
    },
    queries: {
      networkMode: 'always',
      // Erros 4xx não melhoram tentando de novo.
      retry: (failureCount, error) => {
        if (error instanceof ApiError && error.status >= 400 && error.status < 500) return false
        return failureCount < 2
      },
    },
  },
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider>
      <BrowserRouter>
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            <LanguageProvider>
              <App />
            </LanguageProvider>
            <UpdatePrompt />
          </AuthProvider>
        </QueryClientProvider>
      </BrowserRouter>
    </ThemeProvider>
  </StrictMode>,
)
