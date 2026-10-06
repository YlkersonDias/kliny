import { useTheme } from '../../theme/useTheme'
import { Icon } from './Icon'

// Botão liga/desliga do modo escuro: nome fixo e aria-pressed ("Modo escuro, ativado").
// Troca para o oposto do tema na tela e guarda como Claro ou Escuro (sai do "Sistema", se estava
// nele). O ícone mostra o tema atual: lua no escuro, sol no claro.
// 44 px no celular e 40 px a partir do md, alinhado ao link de configurações do menu lateral.
// onSoft: sobre o fundo lilás (login e cadastro), onde muted não tem contraste no tema claro.
export function ThemeToggle({ onSoft = false, className = '' }: { onSoft?: boolean; className?: string }) {
  const { theme, setPreference } = useTheme()
  const isDark = theme === 'dark'
  const colors = onSoft ? 'text-foreground hover:bg-surface' : 'text-muted hover:bg-background hover:text-foreground'

  return (
    <button
      type="button"
      aria-pressed={isDark}
      aria-label="Modo escuro"
      title={isDark ? 'Modo escuro ativado' : 'Modo escuro desativado'}
      onClick={() => setPreference(isDark ? 'light' : 'dark')}
      className={`flex size-11 shrink-0 items-center justify-center rounded-lg transition-colors focus-visible:outline-2 focus-visible:outline-primary md:size-10 ${colors} ${className}`}
    >
      <Icon name={isDark ? 'moon' : 'sun'} />
    </button>
  )
}
