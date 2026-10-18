import { useTranslation } from 'react-i18next'
import { useTheme } from '../../theme/useTheme'
import { Icon } from './Icon'

// Troca para o oposto do tema na tela e guarda como Claro ou Escuro (sai do "Sistema").
// onSoft: sobre o fundo lilás, onde muted não tem contraste no tema claro.
export function ThemeToggle({ onSoft = false, className = '' }: { onSoft?: boolean; className?: string }) {
  const { t } = useTranslation('layout')
  const { theme, setPreference } = useTheme()
  const isDark = theme === 'dark'
  const colors = onSoft ? 'text-foreground hover:bg-surface' : 'text-muted hover:bg-background hover:text-foreground'

  return (
    <button
      type="button"
      aria-pressed={isDark}
      aria-label={t('theme.label')}
      title={isDark ? t('theme.on') : t('theme.off')}
      onClick={() => setPreference(isDark ? 'light' : 'dark')}
      className={`flex size-11 shrink-0 items-center justify-center rounded-lg transition-colors focus-visible:outline-2 focus-visible:outline-primary md:size-10 ${colors} ${className}`}
    >
      <Icon name={isDark ? 'moon' : 'sun'} />
    </button>
  )
}
