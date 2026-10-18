import { useTranslation } from 'react-i18next'
import { Button } from './Button'
import { Icon } from './Icon'

interface PaginationProps {
  page: number
  lastPage: number
  // Já com o plural do idioma ("13 movimentações").
  itemsLabel: string
  onPageChange: (page: number) => void
}

export function Pagination({ page, lastPage, itemsLabel, onPageChange }: PaginationProps) {
  const { t } = useTranslation()
  return (
    <nav aria-label={t('pagination.label')} className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-4 py-3">
      <p className="text-sm text-muted" aria-live="polite">
        {t('pagination.summary', { page, lastPage, items: itemsLabel })}
      </p>
      {lastPage > 1 && (
        <div className="flex gap-2">
          <Button variant="secondary" className="px-3 py-2" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>
            <Icon name="chevronLeft" className="size-4" />
            {t('pagination.previous')}
          </Button>
          <Button variant="secondary" className="px-3 py-2" disabled={page >= lastPage} onClick={() => onPageChange(page + 1)}>
            {t('pagination.next')}
            <Icon name="chevronRight" className="size-4" />
          </Button>
        </div>
      )}
    </nav>
  )
}
