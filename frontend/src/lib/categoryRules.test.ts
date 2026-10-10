import { describe, expect, it } from 'vitest'
import type { CategoryRule } from '../api/types'
import { matchRule, normalizeForMatch } from './categoryRules'

const rule = (id: number, pattern: string, categoryId = id): CategoryRule => ({ id, pattern, categoryId, categoryName: `C${categoryId}` })

describe('normalizeForMatch', () => {
  it('ignora maiúsculas e acentos', () => {
    expect(normalizeForMatch('AÇOUGUE São João')).toBe('acougue sao joao')
  })
})

describe('matchRule', () => {
  const rules = [rule(1, 'mercado'), rule(2, 'Mercado Livre'), rule(3, 'açougue'), rule(4, 'uber')]

  it('acha a regra pelo texto contido, sem diferenciar maiúsculas nem acentos', () => {
    expect(matchRule('Supermercado do bairro', rules)?.id).toBe(1)
    expect(matchRule('ACOUGUE BOI GORDO', rules)?.id).toBe(3)
  })

  it('o texto mais longo vence', () => {
    expect(matchRule('Compra no mercado livre', rules)?.id).toBe(2)
  })

  it('no empate de tamanho, a primeira em ordem alfabética', () => {
    expect(matchRule('uber ubex', [rule(9, 'ubex'), rule(8, 'uber')])?.id).toBe(8)
  })

  it('sem regra que bata, ou descrição vazia, nada', () => {
    expect(matchRule('Farmácia', rules)).toBeNull()
    expect(matchRule('   ', rules)).toBeNull()
    expect(matchRule('Mercado', [])).toBeNull()
  })
})
