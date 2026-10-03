import type { ReactNode } from 'react'
import { APP_NAME } from '../../config/app'

interface AuthLayoutProps {
  title: string
  subtitle: string
  children: ReactNode
}

// Login e cadastro: cartão branco sobre o fundo lilás (o texto fica todo no cartão).
export function AuthLayout({ title, subtitle, children }: AuthLayoutProps) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-surface-soft px-4 py-10">
      <main className="w-full max-w-sm rounded-2xl bg-surface p-6 shadow-lg shadow-primary/10 sm:p-8">
        <p className="text-2xl font-bold tracking-tight text-primary">{APP_NAME}</p>
        <h1 className="mt-6 text-xl font-semibold text-foreground">{title}</h1>
        <p className="mt-1 text-sm text-muted">{subtitle}</p>
        <div className="mt-6">{children}</div>
      </main>
    </div>
  )
}
