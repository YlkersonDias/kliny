import { useEffect, useId, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useLanguage } from '../../language/useLanguage'
import { loadGoogleIdentity, registerGoogleHandler, type GoogleButtonOptions } from '../../lib/googleIdentity'
import { useTheme } from '../../theme/useTheme'

interface GoogleButtonProps {
  text: GoogleButtonOptions['text']
  onCredential: (credential: string) => void
  disabled?: boolean
}

// Limites do Google.
const MIN_WIDTH = 200
const MAX_WIDTH = 400

export function GoogleButton({ text, onCredential, disabled = false }: GoogleButtonProps) {
  const { t } = useTranslation('common')
  const { theme } = useTheme()
  const { language } = useLanguage()
  const state = useId()
  const containerRef = useRef<HTMLDivElement>(null)
  const handlerRef = useRef(onCredential)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    handlerRef.current = onCredential
  }, [onCredential])

  useEffect(() => registerGoogleHandler(state, (credential) => handlerRef.current(credential)), [state])

  useEffect(() => {
    let cancelled = false
    loadGoogleIdentity()
      .then((api) => {
        const container = containerRef.current
        if (cancelled || !container) return
        container.replaceChildren()
        api.renderButton(container, {
          type: 'standard',
          theme: theme === 'dark' ? 'outline_dark' : 'outline',
          size: 'large',
          text,
          shape: 'rectangular',
          logo_alignment: 'center',
          width: Math.min(Math.max(container.offsetWidth, MIN_WIDTH), MAX_WIDTH),
          locale: language === 'en-US' ? 'en' : 'pt-BR',
          state,
        })
      })
      .catch(() => {
        if (!cancelled) setFailed(true)
      })
    return () => {
      cancelled = true
    }
  }, [theme, language, text, state])

  if (failed) return <p className="text-center text-sm text-muted">{t('google.unavailable')}</p>

  // scheme-light: com o app escuro, a diferença de color-scheme pintaria um fundo branco atrás do
  // iframe. O botão provisório do Google depende de <style> inline, que a CSP bloqueia: fica escondido.
  return (
    <div
      ref={containerRef}
      aria-busy={disabled}
      className={`flex min-h-10 w-full justify-center scheme-light [&>div>div:not(:has(iframe))]:hidden ${disabled ? 'pointer-events-none opacity-60' : ''}`}
    />
  )
}
