import { usePageTitle } from '../hooks/usePageTitle'

// Conteúdo provisório das páginas que ainda serão feitas nas próximas partes.
export function UnderConstruction({ title }: { title: string }) {
  usePageTitle(title)

  return (
    <>
      <h1 className="text-2xl font-semibold text-foreground">{title}</h1>
      <p className="mt-2 text-muted">Em construção.</p>
    </>
  )
}
