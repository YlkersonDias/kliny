import { apiBlob } from './client'

export function exportData(): Promise<Blob> {
  return apiBlob('/account/export', { headers: { Accept: 'application/zip, application/problem+json' } })
}
