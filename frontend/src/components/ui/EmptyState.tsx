import type { ReactNode } from 'react'

// Ilustrações em public/mascote/, cada uma em WebP com PNG de reserva.
export type EmptyStateImage = 'sem-resultados' | 'erro' | 'cofre-vazio' | 'sem-dados'

interface EmptyStateProps {
  image: EmptyStateImage
  title: string
  description?: ReactNode
  action?: ReactNode
  // role="alert" no erro, para o leitor de tela anunciar.
  role?: 'alert' | 'status'
}

export function EmptyState({ image, title, description, action, role }: EmptyStateProps) {
  return (
    <div role={role} className="flex flex-col items-center px-4 py-10 text-center">
      {/* Decorativa: o título já diz tudo. */}
      <picture>
        <source srcSet={`/mascote/kliny-${image}-512.webp`} type="image/webp" />
        <img
          src={`/mascote/kliny-${image}-512.png`}
          width={512}
          height={512}
          alt=""
          draggable={false}
          className="size-36 select-none sm:size-44"
        />
      </picture>
      <p className="mt-4 text-lg font-semibold text-foreground">{title}</p>
      {description && <p className="mt-1 max-w-sm text-sm text-muted">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}
