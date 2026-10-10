import { useMutation } from '@tanstack/react-query'
import { checkImport, importLines } from '../api/imports'
import type { ImportLine } from '../api/types'
import { useInvalidateAfterChange } from './useTransactions'

// A conferência não muda nada: é mutação só para não ficar no cache (as linhas são do arquivo).
export function useCheckImport() {
  return useMutation({ mutationFn: (lines: ImportLine[]) => checkImport(lines) })
}

export function useImportLines() {
  const invalidate = useInvalidateAfterChange()
  return useMutation({ mutationFn: (lines: ImportLine[]) => importLines(lines), onSuccess: invalidate })
}
