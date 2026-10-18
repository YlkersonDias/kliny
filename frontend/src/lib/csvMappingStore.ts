import type { CsvMapping } from './csv'

// Só a escolha das colunas (índices, formato da data, inverter): nenhum dado do extrato.

const STORAGE_KEY = 'import.csvLayouts'
const MAX_LAYOUTS = 20

type StoredColumns = Omit<CsvMapping, 'headerRow' | 'hasHeader'>

const COLUMN_FIELDS = ['date', 'description', 'description2', 'amount', 'credit', 'debit', 'id'] as const

function readAll(): Record<string, StoredColumns> {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}')
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? (parsed as Record<string, StoredColumns>) : {}
  } catch {
    return {}
  }
}

// A escolha guardada vale só se ainda couber no arquivo; senão, fica a sugestão.
export function restoreMapping(layout: string, guessed: CsvMapping, width: number): CsvMapping {
  const stored = readAll()[layout]
  if (!stored || typeof stored !== 'object') return guessed
  const validColumn = (value: unknown, optional: boolean) =>
    (optional && value === null) || (Number.isInteger(value) && (value as number) >= 0 && (value as number) < width)
  const ok = validColumn(stored.date, false) && validColumn(stored.description, false)
    && COLUMN_FIELDS.slice(2).every((field) => validColumn(stored[field], true))
    && ['dmy', 'mdy', 'ymd'].includes(stored.dateFormat) && typeof stored.invert === 'boolean'
  if (!ok) return guessed
  const { date, dateFormat, description, description2, amount, credit, debit, id, invert } = stored
  return { ...guessed, date, dateFormat, description, description2, amount, credit, debit, id, invert }
}

export function saveMapping(layout: string, mapping: CsvMapping): void {
  try {
    const all = readAll()
    delete all[layout]
    const { date, dateFormat, description, description2, amount, credit, debit, id, invert } = mapping
    const entries = [...Object.entries(all), [layout, { date, dateFormat, description, description2, amount, credit, debit, id, invert }] as const]
    localStorage.setItem(STORAGE_KEY, JSON.stringify(Object.fromEntries(entries.slice(-MAX_LAYOUTS))))
  } catch {
    // Sem localStorage (bloqueado ou cheio): só não lembra.
  }
}
