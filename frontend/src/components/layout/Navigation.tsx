import { useTranslation } from 'react-i18next'
import { NavLink } from 'react-router'

const items: { to: string; label: 'home' | 'transactions' | 'vaults' | 'reports' | 'simulator'; icon: string }[] = [
  { to: '/', label: 'home', icon: 'M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z' },
  { to: '/movimentacoes', label: 'transactions', icon: 'M7 20V4M3 8l4-4 4 4M17 4v16m4-4-4 4-4-4' },
  { to: '/cofres', label: 'vaults', icon: 'M4 5h16a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1zm8 4a3 3 0 1 0 0 6 3 3 0 0 0 0-6zM7 19v2m10-2v2' },
  { to: '/relatorios', label: 'reports', icon: 'M4 20V10m6 10V4m6 16v-7M3 20h18' },
  { to: '/simulador', label: 'simulator', icon: 'M6 3h12a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1zm2 3h8v3H8zm0 7h.01M12 13h.01M16 13h.01M8 17h.01M12 17h.01M16 17h.01' },
]

export function NavIcon({ path }: { path: string }) {
  return (
    <svg className="size-5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={path} />
    </svg>
  )
}

// Menu lateral no desktop e barra inferior no celular.
export function Navigation({ variant }: { variant: 'sidebar' | 'bar' }) {
  const { t } = useTranslation('layout')
  const isBar = variant === 'bar'

  return (
    <nav aria-label={t('nav.label')}>
      <ul className={isBar ? 'grid grid-cols-5' : 'space-y-1'}>
        {items.map((item) => (
          <li key={item.to}>
            <NavLink
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) => {
                const base = 'flex items-center rounded-lg font-medium transition-colors focus-visible:outline-2 focus-visible:outline-primary'
                // Na barra, cinco itens dividem a largura do celular: fonte de 11 px e pouco espaço dos
                // lados, para "Movimentações" caber até em telas de 320 px.
                const layout = isBar
                  ? 'flex-col gap-1 px-0.5 py-2 text-[0.6875rem] tracking-tight'
                  : 'gap-3 px-3 py-2.5 text-sm'
                const state = isActive
                  ? 'bg-surface-soft/50 text-primary'
                  : 'text-muted hover:bg-background hover:text-foreground'
                return `${base} ${layout} ${state}`
              }}
            >
              <NavIcon path={item.icon} />
              {t(`nav.${item.label}`)}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  )
}
