import { Button } from './Button'
import { Icon } from './Icon'

interface PaginationProps {
  page: number
  lastPage: number
  totalCount: number
  // Nome do item no singular e no plural ("movimentação", "movimentações").
  noun: [string, string]
  onPageChange: (page: number) => void
}

// Rodapé de lista paginada: contagem sempre, botões só quando há mais de uma página.
export function Pagination({ page, lastPage, totalCount, noun, onPageChange }: PaginationProps) {
  return (
    <nav aria-label="Paginação" className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-4 py-3">
      <p className="text-sm text-muted" aria-live="polite">
        Página {page} de {lastPage} · {totalCount} {totalCount === 1 ? noun[0] : noun[1]}
      </p>
      {lastPage > 1 && (
        <div className="flex gap-2">
          <Button variant="secondary" className="px-3 py-2" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>
            <Icon name="chevronLeft" className="size-4" />
            Anterior
          </Button>
          <Button variant="secondary" className="px-3 py-2" disabled={page >= lastPage} onClick={() => onPageChange(page + 1)}>
            Próxima
            <Icon name="chevronRight" className="size-4" />
          </Button>
        </div>
      )}
    </nav>
  )
}
