import type { ComponentProps } from 'react'
import { Spinner } from './Spinner'
import { base, variants, type Variant } from './buttonStyles'

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
      className={`${base} disabled:cursor-not-allowed disabled:opacity-60 ${variants[variant]} ${className}`}
      {...props}
    >
      {isLoading && <Spinner className="size-4" />}
      {children}
    </button>
  )
}
