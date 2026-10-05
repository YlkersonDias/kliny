import { Icon } from './Icon'

interface StatItemProps {
  label: string
  value: string
  valueClass?: string
  // Ícone redondo à esquerda (receita, gasto ou cofre).
  icon?: { name: 'income' | 'expense' | 'vault'; className: string }
  className?: string
}

// Par rótulo/valor de um <dl>. O <div> só pode conter <dt> e <dd> (senão o leitor de tela pode não
// ligar o rótulo ao valor), então o ícone fica dentro do <dt>, posicionado à esquerda do bloco.
export function StatItem({ label, value, valueClass = 'text-foreground', icon, className = '' }: StatItemProps) {
  return (
    <div className={`relative min-h-9 ${icon ? 'pl-12' : ''} ${className}`}>
      <dt className="text-sm text-muted">
        {icon && (
          <span className={`absolute left-0 top-1/2 flex size-9 -translate-y-1/2 items-center justify-center rounded-full bg-background ${icon.className}`}>
            <Icon name={icon.name} className="size-5" />
          </span>
        )}
        {label}
      </dt>
      <dd className={`text-xl font-semibold tabular-nums wrap-anywhere ${valueClass}`}>{value}</dd>
    </div>
  )
}
