import { useQuery } from '@tanstack/react-query'
import { getSummary, getTimeline } from '../api/reports'
import type { ReportPeriod, TimelineGrouping } from '../api/types'

// Todas as chaves começam com 'reports': as mutações de movimentação e de cofre já as invalidam.
export const reportKeys = {
  summary: (period: ReportPeriod) => ['reports', 'summary', period.from, period.to] as const,
  timeline: (period: ReportPeriod, groupBy: TimelineGrouping) => ['reports', 'timeline', period.from, period.to, groupBy] as const,
}

export function useSummary(period: ReportPeriod) {
  return useQuery({
    queryKey: reportKeys.summary(period),
    queryFn: ({ signal }) => getSummary(period, signal),
  })
}

export function useTimeline(period: ReportPeriod, groupBy: TimelineGrouping) {
  return useQuery({
    queryKey: reportKeys.timeline(period, groupBy),
    queryFn: ({ signal }) => getTimeline(period, groupBy, signal),
  })
}
