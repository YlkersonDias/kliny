import { apiRequest } from './client'
import type { ReportPeriod, SummaryResponse, TimelineGrouping, TimelinePoint } from './types'

// from e to são obrigatórios: o servidor não escolhe período porque não conhece o fuso do usuário.
function periodQuery({ from, to }: ReportPeriod): string {
  return new URLSearchParams({ from, to }).toString()
}

export function getSummary(period: ReportPeriod, signal?: AbortSignal): Promise<SummaryResponse> {
  return apiRequest(`/reports/summary?${periodQuery(period)}`, { signal })
}

export function getTimeline(period: ReportPeriod, groupBy: TimelineGrouping, signal?: AbortSignal): Promise<TimelinePoint[]> {
  return apiRequest(`/reports/timeline?${periodQuery(period)}&groupBy=${groupBy}`, { signal })
}
