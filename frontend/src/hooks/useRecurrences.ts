import { useEffect, useRef } from 'react'
import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query'
import {
  createRecurrence, deleteRecurrence, listRecurrences, syncRecurrences, updateRecurrence,
} from '../api/recurrences'
import type { Recurrence, RecurrenceCreateRequest, RecurrenceUpdateRequest } from '../api/types'
import { currentLanguage } from '../i18n'
import { today } from '../lib/dates'

export const recurrenceKeys = {
  all: ['recurrences'] as const,
}

function sortByDescription(recurrences: Recurrence[]): Recurrence[] {
  return [...recurrences].sort((a, b) => a.description.localeCompare(b.description, currentLanguage()))
}

export function useRecurrences() {
  return useQuery({
    queryKey: recurrenceKeys.all,
    queryFn: ({ signal }) => listRecurrences(signal),
    select: sortByDescription,
  })
}

async function syncAndRefresh(queryClient: QueryClient): Promise<void> {
  const { created } = await syncRecurrences(today())
  const refresh: Promise<void>[] = [queryClient.invalidateQueries({ queryKey: recurrenceKeys.all })]
  if (created > 0) {
    refresh.push(
      queryClient.invalidateQueries({ queryKey: ['transactions'] }),
      queryClient.invalidateQueries({ queryKey: ['reports'] }),
      queryClient.invalidateQueries({ queryKey: ['budgets'] }),
    )
  }
  await Promise.all(refresh)
}

// Uma falha na sincronização não desfaz a regra gravada: a próxima abertura lança o que faltar.
async function trySyncAndRefresh(queryClient: QueryClient): Promise<void> {
  try {
    await syncAndRefresh(queryClient)
  } catch {
    await queryClient.invalidateQueries({ queryKey: recurrenceKeys.all })
  }
}

export function useCreateRecurrence() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (request: RecurrenceCreateRequest) => createRecurrence(request),
    onSuccess: () => trySyncAndRefresh(queryClient),
  })
}

export function useUpdateRecurrence() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, request }: { id: number; request: RecurrenceUpdateRequest }) => updateRecurrence(id, request),
    // Retomar ou estender a data final pode ter algo a lançar neste mês.
    onSuccess: () => trySyncAndRefresh(queryClient),
  })
}

export function useDeleteRecurrence() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => deleteRecurrence(id),
    onSuccess: () => Promise.all([
      queryClient.invalidateQueries({ queryKey: recurrenceKeys.all }),
      queryClient.invalidateQueries({ queryKey: ['transactions'] }),
    ]),
  })
}

// Ao abrir o app e quando a aba volta a aparecer num dia novo. Uma falha aqui não atrapalha a tela.
export function useRecurrenceSync(): void {
  const queryClient = useQueryClient()
  const syncedOn = useRef<string | null>(null)

  useEffect(() => {
    function run() {
      const day = today()
      if (syncedOn.current === day) return
      syncedOn.current = day
      syncAndRefresh(queryClient).catch(() => { syncedOn.current = null })
    }
    function handleVisibility() {
      if (document.visibilityState === 'visible') run()
    }

    run()
    document.addEventListener('visibilitychange', handleVisibility)
    return () => document.removeEventListener('visibilitychange', handleVisibility)
  }, [queryClient])
}
