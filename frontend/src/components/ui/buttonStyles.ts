// Aparência dos botões, também usada em links com cara de botão (navegação continua sendo <a>).
export type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'

export const variants: Record<Variant, string> = {
  primary: 'bg-primary text-on-primary hover:bg-primary-hover',
  secondary: 'border border-border bg-surface text-foreground hover:bg-background',
  ghost: 'text-muted hover:bg-background hover:text-foreground',
  // on-danger: branco no claro (4,8:1), marinho no escuro (6,6:1); o hover só aumenta o contraste.
  danger: 'bg-danger text-on-danger hover:bg-danger-hover',
}

export const base = 'inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary'

export function buttonClass(variant: Variant = 'primary'): string {
  return `${base} ${variants[variant]}`
}

