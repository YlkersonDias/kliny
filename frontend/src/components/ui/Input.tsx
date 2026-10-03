import { useId, type ComponentProps } from 'react'

interface InputProps extends ComponentProps<'input'> {
  label: string
  error?: string
  hint?: string
}

// Campo com rótulo visível. Dica e erro ficam ligados ao campo por aria-describedby.
export function Input({ label, error, hint, id, className = '', ...props }: InputProps) {
  const generatedId = useId()
  const inputId = id ?? generatedId
  const hintId = `${inputId}-hint`
  const errorId = `${inputId}-error`
  const describedBy = [hint && hintId, error && errorId].filter(Boolean).join(' ') || undefined

  return (
    <div className={className}>
      <label htmlFor={inputId} className="mb-1.5 block text-sm font-medium text-foreground">
        {label}
      </label>
      <input
        id={inputId}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className={`block w-full rounded-lg border bg-surface px-3 py-2.5 text-foreground outline-none transition-colors focus:ring-2 ${
          error
            ? 'border-danger focus:border-danger focus:ring-danger/20'
            : 'border-border focus:border-primary focus:ring-primary/20'
        }`}
        {...props}
      />
      {hint && !error && <p id={hintId} className="mt-1.5 text-sm text-muted">{hint}</p>}
      {error && <p id={errorId} className="mt-1.5 text-sm text-danger">{error}</p>}
    </div>
  )
}
