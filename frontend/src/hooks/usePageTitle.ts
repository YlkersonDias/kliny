import { useEffect } from 'react'
import { APP_NAME } from '../config/app'

export function usePageTitle(title: string) {
  useEffect(() => {
    document.title = `${title} · ${APP_NAME}`
  }, [title])
}
