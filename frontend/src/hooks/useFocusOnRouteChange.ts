import { useEffect, useRef } from 'react'
import { useLocation } from 'react-router'

// Ao trocar de página, leva o foco ao <h1> (ou ao <main>, se a página ainda não tem título):
// o leitor de tela anuncia a página nova e o Tab recomeça dali, e não do link clicado.
// Só o caminho conta: mudar filtros na URL (?periodo=, ?pagina=) não move o foco.
// No carregamento inicial o foco fica onde o navegador põe (o "Pular para o conteúdo" vem primeiro).
export function useFocusOnRouteChange() {
  const { pathname } = useLocation()
  const previous = useRef(pathname)

  useEffect(() => {
    if (previous.current === pathname) return
    previous.current = pathname
    const main = document.querySelector('main')
    const target = main?.querySelector<HTMLElement>('h1') ?? main
    if (!target) return
    // tabindex -1: focável por código, fora da ordem do Tab (o contorno some pelo CSS base).
    if (!target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1')
    target.focus()
  }, [pathname])
}
