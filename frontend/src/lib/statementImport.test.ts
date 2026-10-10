import { describe, expect, it } from 'vitest'
import type { CategoryRule } from '../api/types'
import type { StatementLine } from './ofx'
import { buildReviewRows, dateSpan, looksLikeTransfer } from './statementImport'

function line(description: string, date = '2026-10-01', amount = -10): StatementLine {
  return { source: '077:1', externalId: null, date, amount, description, occurrence: 1 }
}

describe('looksLikeTransfer', () => {
  it.each([
    'PAGAMENTO DE FATURA', 'Pagto fatura cartão', 'PAG FAT ITAU', 'Pagamento recebido', 'Guardado na Caixinha',
    'Aplicação RDB', 'Resgate RDB', 'APLICACAO CDB', 'Transf. para Poupança', 'Cofrinho Inter', 'Investimentos',
  ])('%s', (description) => {
    expect(looksLikeTransfer(description)).toBe(true)
  })

  it.each(['Mercado Bom Preço', 'Pix enviado: Maria', 'Faturamento Ltda', 'Uber *Trip', 'CDBX Loja'])('não: %s', (description) => {
    expect(looksLikeTransfer(description)).toBe(false)
  })
})

describe('buildReviewRows', () => {
  const rules: CategoryRule[] = [{ id: 1, pattern: 'mercado', categoryId: 7, categoryName: 'Alimentação' }]

  it('marca as novas, desmarca as parecidas e as transferências, trava as já importadas', () => {
    const rows = buildReviewRows(
      [line('Mercado Bom Preço'), line('Uber'), line('Pagamento de fatura'), line('Padaria')],
      ['new', 'imported', 'new', 'similar'],
      rules,
    )
    expect(rows.map((r) => [r.flag, r.selected, r.disabled])).toEqual([
      [null, true, false],
      ['imported', false, true],
      ['transfer', false, false],
      ['similar', false, false],
    ])
    expect(rows[0]).toMatchObject({ categoryId: '7', rulePattern: 'mercado' })
    expect(rows[1]).toMatchObject({ categoryId: '', rulePattern: null })
  })
})

describe('dateSpan', () => {
  it('menor e maior data', () => {
    expect(dateSpan([line('a', '2026-10-05'), line('b', '2026-09-30'), line('c', '2026-10-01')])).toEqual({ from: '2026-09-30', to: '2026-10-05' })
    expect(dateSpan([])).toBeNull()
  })
})
