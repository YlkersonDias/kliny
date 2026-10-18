import { Icon } from './Icon'

interface IconButtonProps {
  icon: 'edit' | 'trash'
  // Diz o que e de quem ("Apagar Mercado de 02/10/2026").
  label: string
  onClick: () => void
  className?: string
}

// 44 px no celular e 32 px a partir do md, onde o ponteiro é mais preciso.
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
