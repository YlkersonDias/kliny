import { LANGUAGE_SHORT_NAMES, type Language } from '../../lib/language'
import { useLanguage } from '../../language/useLanguage'

const SWITCH_ID = 'trocar-idioma'

// O nome do idioma de destino escrito nele mesmo, para quem não lê o atual.
export function LanguageSwitch({ className = '' }: { className?: string }) {
  const { language, setLanguage } = useLanguage()
  const target: Language = language === 'pt-BR' ? 'en-US' : 'pt-BR'

  return (
    <button
      type="button"
      id={SWITCH_ID}
      lang={target}
      onClick={() => setLanguage(target, SWITCH_ID)}
      className={`flex h-11 shrink-0 items-center rounded-lg px-3 text-sm font-semibold text-foreground transition-colors hover:bg-surface focus-visible:outline-2 focus-visible:outline-primary md:h-10 ${className}`}
    >
      {LANGUAGE_SHORT_NAMES[target]}
    </button>
  )
}
