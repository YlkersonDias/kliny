import { describe, expect, it } from 'vitest'
import { goalProgress, sumMoney, vaultAmount } from './vaults'

describe('sumMoney', () => {
  it('soma sem erro de ponto flutuante', () => {
    expect(sumMoney([0.1, 0.2])).toBe(0.3)
    expect(sumMoney([1234.56, 0.44, 100])).toBe(1335)
  })

  it('lista vazia dá zero', () => {
    expect(sumMoney([])).toBe(0)
  })
})

describe('goalProgress', () => {
  it('calcula o percentual e quanto falta', () => {
    expect(goalProgress(450, 1000)).toEqual({ percent: 45, reached: false, remaining: 550 })
  })

  it('arredonda para baixo e não mostra 100% antes da meta', () => {
    expect(goalProgress(999.99, 1000)).toEqual({ percent: 99, reached: false, remaining: 0.01 })
    expect(goalProgress(0.1, 0.3).percent).toBe(33)
  })

  it('meta exata e acima da meta ficam em 100%', () => {
    expect(goalProgress(1000, 1000)).toEqual({ percent: 100, reached: true, remaining: 0 })
    expect(goalProgress(1500, 1000)).toEqual({ percent: 100, reached: true, remaining: 0 })
  })

  it('saldo zero', () => {
    expect(goalProgress(0, 500)).toEqual({ percent: 0, reached: false, remaining: 500 })
  })
})

describe('vaultAmount', () => {
  it('inverte o sinal da conta para o do cofre', () => {
    expect(vaultAmount(-100)).toBe(100) // depósito
    expect(vaultAmount(50)).toBe(-50) // retirada
    expect(Object.is(vaultAmount(0), 0)).toBe(true)
  })
})
