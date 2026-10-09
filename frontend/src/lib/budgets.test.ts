import { describe, expect, it } from 'vitest'
import { budgetMonth, budgetProgress } from './budgets'

describe('budgetProgress', () => {
  it('abaixo de 80% está ok, com o que falta', () => {
    expect(budgetProgress(800, 150.5)).toEqual({ status: 'ok', percent: 18, bar: 18, difference: 649.5 })
  })

  it('de 80% até o limite está perto', () => {
    expect(budgetProgress(100, 80).status).toBe('near')
    expect(budgetProgress(100, 100)).toEqual({ status: 'near', percent: 100, bar: 100, difference: 0 })
  })

  it('arredonda o percentual para baixo: 99,6% não vira 100%', () => {
    expect(budgetProgress(250, 249).percent).toBe(99)
  })

  it('acima do limite passou, com quanto passou e a barra cheia', () => {
    expect(budgetProgress(100, 150.25)).toEqual({ status: 'over', percent: 150, bar: 100, difference: 50.25 })
  })

  it('soma em centavos, sem erro de ponto flutuante', () => {
    expect(budgetProgress(0.3, 0.1 + 0.2).status).toBe('near')
    expect(budgetProgress(0.3, 0.1 + 0.2).difference).toBe(0)
  })

  it('sem gasto', () => {
    expect(budgetProgress(500, 0)).toEqual({ status: 'ok', percent: 0, bar: 0, difference: 500 })
  })
})

describe('budgetMonth', () => {
  it('usa o ano e o mês do início do período', () => {
    expect(budgetMonth({ from: '2026-10-01', to: '2026-10-31' })).toBe('2026-10')
  })
})
