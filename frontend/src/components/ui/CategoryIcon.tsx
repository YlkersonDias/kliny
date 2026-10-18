import type { ReactNode } from 'react'
import type { Category } from '../../api/types'
import { categoryColorVar, categoryLook, type CategoryColor, type CategoryIconName } from '../../lib/categoryAppearance'

const GLYPHS: Record<CategoryIconName, ReactNode> = {
  cart: <><path d="M3 4h2l2.4 11.2a1 1 0 0 0 1 .8h8.9a1 1 0 0 0 1-.8L20 8H6.2" /><circle cx="9" cy="20" r="1.3" /><circle cx="17" cy="20" r="1.3" /></>,
  home: <path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" />,
  car: <path d="M5 16v-5l2-5h10l2 5v5M3 16h18M7 16v2M17 16v2M7.5 12.5h.01M16.5 12.5h.01" />,
  bus: <><rect x="5" y="3" width="14" height="14" rx="2" /><path d="M5 11h14M8 17v3M16 17v3M8.5 14h.01M15.5 14h.01" /></>,
  food: <path d="M6 3v7a2 2 0 0 0 2 2v9M4 3v5M10 3v5M17 21V3c-2 1.5-3 4-3 7v3h3" />,
  coffee: <path d="M4 9h12v5a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5zM16 10h1.5a2.5 2.5 0 0 1 0 5H16M8 3v3M12 3v3" />,
  health: <path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10zM12 9v5M9.5 11.5h5" />,
  education: <path d="M2 9l10-5 10 5-10 5zM6 11v5c3 2 9 2 12 0v-5M22 9v6" />,
  leisure: <path d="M6 8h12a4 4 0 0 1 0 8H6a4 4 0 0 1 0-8zM7 12h3M8.5 10.5v3M15 11h.01M17 13h.01" />,
  gift: <path d="M4 11h16v9H4zM3 8h18v3H3zM12 8v12M12 8c-1-3-5-3-5-1s3 1 5 1zm0 0c1-3 5-3 5-1s-3 1-5 1z" />,
  pets: <><ellipse cx="12" cy="16" rx="3.5" ry="3" /><circle cx="6.5" cy="10.5" r="1.6" /><circle cx="9.5" cy="6.5" r="1.6" /><circle cx="14.5" cy="6.5" r="1.6" /><circle cx="17.5" cy="10.5" r="1.6" /></>,
  clothes: <path d="M8 4 3 7l2 4 2-1v10h10V10l2 1 2-4-5-3c-1 1.5-2.5 2-4 2s-3-.5-4-2z" />,
  salary: <><rect x="3" y="6" width="18" height="12" rx="2" /><circle cx="12" cy="12" r="2.5" /><path d="M6.5 9h.01M17.5 15h.01" /></>,
  invest: <path d="M3 17l6-6 4 4 8-8M15 7h6v6" />,
  travel: <><rect x="4" y="7" width="16" height="12" rx="2" /><path d="M9 7V5h6v2M4 12h16" /></>,
  bills: <path d="M13 2 4 14h7l-1 8 9-12h-7z" />,
  phone: <><rect x="7" y="2" width="10" height="20" rx="2" /><path d="M11 18h2" /></>,
  streaming: <><rect x="3" y="5" width="18" height="13" rx="2" /><path d="M10 9l5 2.5-5 2.5zM8 21h8" /></>,
  gym: <path d="M6 7v10M3 9v6M18 7v10M21 9v6M6 12h12" />,
  beauty: <path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8zM19 15l.7 2 2 .7-2 .7-.7 2-.7-2-2-.7 2-.7z" />,
  baby: <><circle cx="12" cy="12" r="8" /><path d="M9.5 10.5h.01M14.5 10.5h.01M9.5 14.5c1.5 1.3 3.5 1.3 5 0M12 4c1.2 1.4.4 3-1 3" /></>,
  tools: <path d="M14 6l4 4M4 20l9-9M13 4l7 7-2 2-7-7z" />,
  savings: <path d="M4 5h16a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1zm8 4a3 3 0 1 0 0 6 3 3 0 0 0 0-6zM7 19v2m10-2v2" />,
  tag: <path d="M3 12V4a1 1 0 0 1 1-1h8l9 9-9 9zM7.5 7.5h.01" />,
}

export function CategoryGlyph({ icon, className = 'size-5' }: { icon: CategoryIconName; className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {GLYPHS[icon]}
    </svg>
  )
}

interface CategoryIconProps {
  // Nula para "Sem categoria" (cinza, com a etiqueta).
  category?: Pick<Category, 'color' | 'icon'> | null
  // Uma escolha ainda não salva, no formulário da categoria.
  look?: { color: CategoryColor; icon: CategoryIconName }
  size?: string
}

// Decorativo: o nome da categoria sempre aparece ao lado, e a cor nunca é a única pista.
export function CategoryIcon({ category, look, size = 'size-9' }: CategoryIconProps) {
  const { color, icon } = look ?? categoryLook(category)
  const value = categoryColorVar(color)
  return (
    <span
      aria-hidden="true"
      className={`flex flex-none items-center justify-center rounded-full ${size}`}
      style={{ color: value, backgroundColor: `color-mix(in srgb, ${value} 16%, var(--color-surface))` }}
    >
      <CategoryGlyph icon={icon} className="size-[60%]" />
    </span>
  )
}
