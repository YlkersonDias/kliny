import { useEffect, useId, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useLanguage } from '../../language/useLanguage'
import { loadGoogleIdentity, registerGoogleHandler, type GoogleButtonOptions } from '../../lib/googleIdentity'
import { useTheme } from '../../theme/useTheme'

interface GoogleButtonProps {
  text: GoogleButtonOptions['text']
  // Recebe o comprovante (ID token) do Google depois que a pessoa escolhe a conta.
  onCredential: (credential: string) => void
  // Durante o envio: o botão fica visível, mas não recebe cliques.
  disabled?: boolean
}

// Largura do botão do Google: entre 200 e 400 px (limite do Google), acompanhando o espaço.
const MIN_WIDTH = 200
const MAX_WIDTH = 400

// O botão oficial "Fazer login com o Google", desenhado pelo próprio Google num iframe, no tema e
// no idioma da tela. Sem conexão ou com o script bloqueado, mostra um aviso no lugar.
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

  // scheme-light: o documento do Google dentro do iframe é claro. Com o app no tema escuro, a
  // diferença de color-scheme faz o navegador pintar um fundo branco atrás do iframe (uma borda
  // branca em volta do botão); com o mesmo esquema, o fundo fica transparente.
  // Enquanto o iframe carrega, o Google mostra um botão provisório em HTML que depende de um
  // <style> inline, bloqueado pela CSP (sem 'unsafe-inline'): sem estilo, o logo aparece enorme.
  // O provisório fica escondido; o que contém o iframe nunca é escondido.
  return (
    <div
      ref={containerRef}
      aria-busy={disabled}
      className={`flex min-h-10 w-full justify-center scheme-light [&>div>div:not(:has(iframe))]:hidden ${disabled ? 'pointer-events-none opacity-60' : ''}`}
    />
  )
}
