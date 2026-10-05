import type { Category } from '../../api/types'
import type { TransactionFilters, TypeFilter } from '../../lib/transactionFilters'
import { Button } from '../ui/Button'
import { Input } from '../ui/Input'
import { Select } from '../ui/Select'

interface TransactionFiltersBarProps {
  filters: TransactionFilters
  categories: Category[]
  rangeError?: string
  canClear: boolean
  onChange: (patch: Partial<TransactionFilters>) => void
  onClear: () => void
}

export function TransactionFiltersBar({ filters, categories, rangeError, canClear, onChange, onClear }: TransactionFiltersBarProps) {
  const isVault = filters.type === 'cofres'

  return (
    <section aria-label="Filtros" className="rounded-2xl border border-border bg-surface p-4 sm:p-5">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Input
          label="De"
          type="date"
          min="0001-01-01"
          max="9999-12-31"
          value={filters.from}
          onChange={(event) => onChange({ from: event.target.value })}
        />
        <Input
          label="Até"
          type="date"
          min="0001-01-01"
          max="9999-12-31"
          value={filters.to}
          onChange={(event) => onChange({ to: event.target.value })}
          error={rangeError}
        />
        <Select
          label="Categoria"
          value={filters.category}
          disabled={isVault}
          title={isVault ? 'Operações de cofre não têm categoria.' : undefined}
          onChange={(event) => onChange({ category: event.target.value })}
        >
          <option value="">Todas</option>
          <option value="sem">Sem categoria</option>
          {categories.map((category) => (
            <option key={category.id} value={category.id}>{category.name}</option>
          ))}
        </Select>
        <Select
          label="Tipo"
          value={filters.type}
          onChange={(event) => {
            const type = event.target.value as TypeFilter
            onChange(type === 'cofres' ? { type, category: '' } : { type })
          }}
        >
          <option value="">Todos</option>
          <option value="receitas">Receitas</option>
          <option value="gastos">Gastos</option>
          <option value="cofres">Cofres</option>
        </Select>
      </div>
      {canClear && (
        <div className="mt-3 flex justify-end">
          <Button variant="ghost" className="px-3 py-2" onClick={onClear}>Limpar filtros</Button>
        </div>
      )}
    </section>
  )
}
