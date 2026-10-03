import { useEffect } from 'react'
import { APP_NAME } from '../config/app'

// Título da aba: "Movimentações · Kliny".
export function usePageTitle(title: string) {
  useEffect(() => {
    document.title = `${title} · ${APP_NAME}`
  }, [title])
}
