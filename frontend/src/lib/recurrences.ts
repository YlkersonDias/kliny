import type { Recurrence } from '../api/types'

export type RecurrenceStatus = 'active' | 'paused' | 'ended'

// Terminou: a próxima ocorrência já passou da data final.
export function recurrenceStatus(recurrence: Pick<Recurrence, 'paused' | 'endDate' | 'nextDate'>): RecurrenceStatus {
  if (recurrence.endDate !== null && recurrence.nextDate > recurrence.endDate) return 'ended'
  return recurrence.paused ? 'paused' : 'active'
}

// Sem passar por Date, que leria a data em UTC.
export function dayOfMonth(isoDate: string): number {
  return Number(isoDate.slice(8, 10))
}
