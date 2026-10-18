import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { getByCategory, getSummary, getTimeline } from '../api/reports'
import type { CategoryReportType, ReportPeriod, TimelineGrouping } from '../api/types'

// Todas começam com 'reports': as mutações de movimentação e de cofre já as invalidam.
export const reportKeys = {
  summary: (period: ReportPeriod) => ['reports', 'summary', period.from, period.to] as const,
  byCategory: (period: ReportPeriod, type: CategoryReportType) => ['reports', 'by-category', period.from, period.to, type] as const,
  timeline: (period: ReportPeriod, groupBy: TimelineGrouping) => ['reports', 'timeline', period.from, period.to, groupBy] as const,
}

interface Options {
  enabled?: boolean
  // O resultado anterior fica na tela até o novo chegar.
  keepPrevious?: boolean
}

export function useSummary(period: ReportPeriod, { enabled = true, keepPrevious = false }: Options = {}) {
  return useQuery({
    queryKey: reportKeys.summary(period),
    queryFn: ({ signal }) => getSummary(period, signal),
    enabled,
    placeholderData: keepPrevious ? keepPreviousData : undefined,
  })
}

export function useCategoryReport(period: ReportPeriod, type: CategoryReportType, { enabled = true, keepPrevious = false }: Options = {}) {
  return useQuery({
    queryKey: reportKeys.byCategory(period, type),
    queryFn: ({ signal }) => getByCategory(period, type, signal),
    enabled,
    placeholderData: keepPrevious ? keepPreviousData : undefined,
  })
}

export function useTimeline(period: ReportPeriod, groupBy: TimelineGrouping, { enabled = true, keepPrevious = false }: Options = {}) {
  return useQuery({
    queryKey: reportKeys.timeline(period, groupBy),
    queryFn: ({ signal }) => getTimeline(period, groupBy, signal),
    enabled,
    placeholderData: keepPrevious ? keepPreviousData : undefined,
  })
}
