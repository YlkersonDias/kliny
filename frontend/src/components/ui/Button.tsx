import type { ComponentProps } from 'react'
import { Spinner } from './Spinner'

type Variant = 'primary' | 'secondary' | 'ghost'

const variants: Record<Variant, string> = {
  primary: 'bg-primary text-white hover:bg-primary-hover',
  secondary: 'border border-border bg-surface text-foreground hover:bg-background',
  ghost: 'text-muted hover:bg-background hover:text-foreground',
}

interface ButtonProps extends ComponentProps<'button'> {
  variant?: Variant
  isLoading?: boolean
}

export function Button({
  variant = 'primary',
  isLoading = false,
  disabled,
  type = 'button',
  className = '',
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled || isLoading}
      aria-busy={isLoading || undefined}
      className={`inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-60 ${variants[variant]} ${className}`}
      {...props}
    >
      {isLoading && <Spinner className="size-4" />}
      {children}
    </button>
  )
}
