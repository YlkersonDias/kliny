import { useTranslation } from 'react-i18next'

export function Spinner({ className = 'size-5' }: { className?: string }) {
  return (
    <svg className={`animate-spin ${className}`} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" className="opacity-25" />
      <path d="M22 12a10 10 0 0 0-10-10" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
    </svg>
  )
}

export function FullPageSpinner() {
  const { t } = useTranslation()
  return (
    <div className="flex min-h-dvh items-center justify-center text-primary" role="status">
      <Spinner className="size-8" />
      <span className="sr-only">{t('loading')}</span>
    </div>
  )
}
