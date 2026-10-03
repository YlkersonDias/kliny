import { NavLink } from 'react-router'

const items = [
  { to: '/', label: 'Início', icon: 'M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z' },
  { to: '/movimentacoes', label: 'Movimentações', icon: 'M7 20V4M3 8l4-4 4 4M17 4v16m4-4-4 4-4-4' },
  { to: '/cofres', label: 'Cofres', icon: 'M4 5h16a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1zm8 4a3 3 0 1 0 0 6 3 3 0 0 0 0-6zM7 19v2m10-2v2' },
  { to: '/relatorios', label: 'Relatórios', icon: 'M4 20V10m6 10V4m6 16v-7M3 20h18' },
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
  const isBar = variant === 'bar'

  return (
    <nav aria-label="Menu principal">
      <ul className={isBar ? 'grid grid-cols-4' : 'space-y-1'}>
        {items.map((item) => (
          <li key={item.to}>
            <NavLink
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) => {
                const base = 'flex items-center rounded-lg font-medium transition-colors focus-visible:outline-2 focus-visible:outline-primary'
                const layout = isBar
                  ? 'flex-col gap-1 px-1 py-2 text-xs'
                  : 'gap-3 px-3 py-2.5 text-sm'
                const state = isActive
                  ? 'bg-surface-soft/50 text-primary'
                  : 'text-muted hover:bg-background hover:text-foreground'
                return `${base} ${layout} ${state}`
              }}
            >
              <NavIcon path={item.icon} />
              {item.label}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  )
}
