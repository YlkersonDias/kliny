import type { ReactNode } from 'react'
import { APP_NAME } from '../../config/app'

interface AuthLayoutProps {
  title: string
  subtitle: string
  // Mascote apoiado na borda superior do cartão (só na tela de login).
  mascot?: boolean
  children: ReactNode
}

// Login e cadastro: cartão branco sobre o fundo lilás (o texto fica todo no cartão).
export function AuthLayout({ title, subtitle, mascot = false, children }: AuthLayoutProps) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-surface-soft px-4 py-10">
      <div className="w-full max-w-sm">
        {/*
          O mascote fica fora do fluxo, então a margem reserva o espaço dele acima do cartão.
          Percentuais de margem são relativos à largura do cartão: a imagem (440x239) ocupa
          91,7% da largura, ou seja 49,8% de altura, menos os 3,54% que descem sobre a borda.
        */}
        <main className={`relative rounded-2xl bg-surface p-6 shadow-lg shadow-primary/10 sm:p-8 ${mascot ? 'mt-[46.3%]' : ''}`}>
          {mascot && (
            <img
              src="/mascote/kliny-login-mascote.png"
              srcSet="/mascote/kliny-login-mascote.png 1x, /mascote/kliny-login-mascote@2x.png 2x"
              width={440}
              height={239}
              alt=""
              draggable={false}
              className="pointer-events-none absolute bottom-full left-[4.2%] z-10 -mb-[3.54%] h-auto w-[91.7%] select-none"
            />
          )}
          <p className="text-2xl font-bold tracking-tight text-primary">{APP_NAME}</p>
          <h1 className="mt-6 text-xl font-semibold text-foreground">{title}</h1>
          <p className="mt-1 text-sm text-muted">{subtitle}</p>
          <div className="mt-6">{children}</div>
        </main>
      </div>
    </div>
  )
}
