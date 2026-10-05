import { Icon } from './Icon'

interface IconButtonProps {
  icon: 'edit' | 'trash'
  // Texto do leitor de tela e da dica ao passar o mouse; diz o que e de quem ("Apagar Mercado de 02/10/2026").
  label: string
  onClick: () => void
  // Só posição e margem (o tamanho e as cores são fixos).
  className?: string
}

// Botão só com ícone. Alvo de toque de 44 px no celular (o recomendado, acima do mínimo de 24 px
// do WCAG 2.2) e 32 px a partir do md, onde o ponteiro é mais preciso.
export function IconButton({ icon, label, onClick, className = '' }: IconButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={`flex size-11 shrink-0 items-center justify-center rounded-lg text-muted transition-colors hover:bg-background hover:text-foreground focus-visible:outline-2 focus-visible:outline-primary md:size-8 ${className}`}
    >
      <Icon name={icon} className="size-4" />
    </button>
  )
}
