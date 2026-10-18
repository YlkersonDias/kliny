import type { ReactNode } from 'react'

const variants = {
  error: 'border-danger/30 bg-danger/5 text-danger',
  info: 'border-primary/30 bg-primary/5 text-primary',
}

interface FormAlertProps {
  variant?: keyof typeof variants
  children: ReactNode
}

export function FormAlert({ variant = 'error', children }: FormAlertProps) {
  return (
    <div
      role={variant === 'error' ? 'alert' : 'status'}
      className={`rounded-lg border px-4 py-3 text-sm ${variants[variant]}`}
    >
      {children}
    </div>
  )
}
