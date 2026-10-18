import { addMonthsClamped } from './dates'

export const INSTALLMENT_MIN = 2
export const INSTALLMENT_MAX = 120
// 255 da movimentação menos o " (120/120)" que a API acrescenta em cada parcela.
export const INSTALLMENT_DESCRIPTION_MAX = 245

// Mesma divisão da API: em centavos, com a sobra na primeira parcela.
export function splitInstallments(total: number, count: number): { first: number; each: number } {
  const cents = Math.round(total * 100)
  const each = Math.floor(cents / count)
  return { first: (each + (cents % count)) / 100, each: each / 100 }
}

// 31 cai no último dia dos meses curtos.
export function lastInstallmentDate(firstDate: string, count: number): string {
  return addMonthsClamped(firstDate, count - 1)
}

export function parseInstallmentCount(text: string): number | null {
  if (!/^\d{1,3}$/.test(text.trim())) return null
  const count = Number(text.trim())
  return count >= INSTALLMENT_MIN && count <= INSTALLMENT_MAX ? count : null
}
