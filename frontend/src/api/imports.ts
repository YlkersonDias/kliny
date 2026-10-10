import { apiRequest } from './client'
import type { ImportCheckResponse, ImportLine, ImportResponse } from './types'

// Importação de extrato (8.3): só as linhas, nunca o arquivo.
export function checkImport(lines: ImportLine[]): Promise<ImportCheckResponse> {
  return apiRequest('/imports/check', { method: 'POST', body: { lines } })
}

export function importLines(lines: ImportLine[]): Promise<ImportResponse> {
  return apiRequest('/imports', { method: 'POST', body: { lines } })
}
