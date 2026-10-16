import { apiBlob } from './client'

// O .zip com todos os dados da conta (JSON completo e CSV das movimentações).
export function exportData(): Promise<Blob> {
  return apiBlob('/account/export', { headers: { Accept: 'application/zip, application/problem+json' } })
}
