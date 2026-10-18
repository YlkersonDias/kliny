import { useId, type ComponentProps } from 'react'

interface SelectProps extends ComponentProps<'select'> {
  label: string
  error?: string
  hint?: string
}

export function Select({ label, error, hint, id, className = '', children, ...props }: SelectProps) {
  const generatedId = useId()
  const selectId = id ?? generatedId
  const errorId = `${selectId}-error`
  const hintId = `${selectId}-hint`
  const describedBy = [hint && !error && hintId, error && errorId].filter(Boolean).join(' ') || undefined

  return (
    <div className={className}>
      <label htmlFor={selectId} className="mb-1.5 block text-sm font-medium text-foreground">
        {label}
      </label>
      <select
        id={selectId}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className={`block w-full rounded-lg border bg-surface px-3 py-2.5 text-foreground outline-none transition-colors focus:ring-2 ${
          error
            ? 'border-danger focus:border-danger focus:ring-danger/20'
            : 'border-border focus:border-primary focus:ring-primary/20'
        }`}
        {...props}
      >
        {children}
      </select>
      {hint && !error && <p id={hintId} className="mt-1.5 text-sm text-muted">{hint}</p>}
      {error && <p id={errorId} className="mt-1.5 text-sm text-danger">{error}</p>}
    </div>
  )
}
