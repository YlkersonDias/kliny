import { describe, expect, it } from 'vitest'
import { goalProgress, goalReachedNotice, parseGoalInput, sumMoney, vaultAmount, vaultOperationDateError } from './vaults'

describe('parseGoalInput', () => {
  it('valor positivo vira a meta', () => {
    expect(parseGoalInput('1.000')).toBe(1000)
    expect(parseGoalInput('R$ 250,50')).toBe(250.5)
    expect(parseGoalInput(' 0,01 ')).toBe(0.01)
  })

  it('vazio, zero e negativo contam como sem meta', () => {
    for (const text of ['', '   ', '0', '0,00', 'R$ 0', '-10', '-0', '- 5,50', '−10', 'R$ -10', '-R$ 10']) {
      expect(parseGoalInput(text)).toBeNull()
    }
  })

  it('texto que não é valor continua inválido', () => {
    for (const text of ['abc', '12.50', '0,001', '-abc', '--10']) {
      expect(parseGoalInput(text)).toBe('invalid')
    }
  })
})

describe('goalReachedNotice', () => {
  it('avisa quando o saldo já atinge a meta (inclusive igual)', () => {
    expect(goalReachedNotice(300, 500)).toBe('O cofre já tem R$ 500,00 guardados, o que já atinge esta meta. Ele vai aparecer como “Meta atingida”.')
    expect(goalReachedNotice(500, 500)).toBeDefined()
    expect(goalReachedNotice(0.3, 0.1 + 0.2)).toBeDefined() // centavos, sem erro de ponto flutuante
  })

  it('sem aviso quando a meta está acima do saldo, sem meta ou sem saldo', () => {
    expect(goalReachedNotice(500.01, 500)).toBeUndefined()
    expect(goalReachedNotice(null, 500)).toBeUndefined()
    expect(goalReachedNotice(0, 500)).toBeUndefined()
    expect(goalReachedNotice(300, 0)).toBeUndefined()
  })
})

describe('vaultOperationDateError', () => {
  it('aceita hoje e datas passadas', () => {
    expect(vaultOperationDateError('2026-10-05', '2026-10-05')).toBeUndefined()
    expect(vaultOperationDateError('2026-10-04', '2026-10-05')).toBeUndefined()
    expect(vaultOperationDateError('2020-01-15', '2026-10-05')).toBeUndefined()
  })

  it('recusa data futura, inclusive na virada de mês e de ano', () => {
    expect(vaultOperationDateError('2026-10-06', '2026-10-05')).toBeDefined()
    expect(vaultOperationDateError('2026-11-01', '2026-10-31')).toBeDefined()
    expect(vaultOperationDateError('2027-01-01', '2026-12-31')).toBeDefined()
  })
})

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
