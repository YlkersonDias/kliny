import { useEffect, useRef } from 'react'
import { useLocation } from 'react-router'

// O leitor de tela anuncia a página nova e o Tab recomeça dali. Só o caminho conta: filtros na
// URL não movem o foco.
export function useFocusOnRouteChange() {
  const { pathname } = useLocation()
  const previous = useRef(pathname)

  useEffect(() => {
    if (previous.current === pathname) return
    previous.current = pathname
    const main = document.querySelector('main')
    const target = main?.querySelector<HTMLElement>('h1') ?? main
    if (!target) return
    if (!target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1')
    target.focus()
  }, [pathname])
}
