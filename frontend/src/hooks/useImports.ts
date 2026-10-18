import { useMutation } from '@tanstack/react-query'
import { checkImport, importLines } from '../api/imports'
import type { ImportLine } from '../api/types'
import { useInvalidateAfterChange } from './useTransactions'

// Mutação, e não consulta, para as linhas do arquivo não ficarem no cache.
export function useCheckImport() {
  return useMutation({ mutationFn: (lines: ImportLine[]) => checkImport(lines) })
}

export function useImportLines() {
  const invalidate = useInvalidateAfterChange()
  return useMutation({ mutationFn: (lines: ImportLine[]) => importLines(lines), onSuccess: invalidate })
}
