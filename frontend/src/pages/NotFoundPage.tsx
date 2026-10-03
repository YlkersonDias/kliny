import { Link } from 'react-router'
import { usePageTitle } from '../hooks/usePageTitle'

export default function NotFoundPage() {
  usePageTitle('Página não encontrada')

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-4 text-center">
      <p className="text-sm font-semibold text-primary">404</p>
      <h1 className="mt-2 text-2xl font-semibold text-foreground">Página não encontrada</h1>
      <p className="mt-2 text-muted">O endereço pode estar errado ou a página não existe mais.</p>
      <Link
        to="/"
        className="mt-6 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-white hover:bg-primary-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
      >
        Voltar ao início
      </Link>
    </main>
  )
}
