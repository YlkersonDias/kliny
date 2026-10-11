import { describe, expect, it } from 'vitest'
import { caretAfterTyping, formatMoney, formatMoneyTyping, formatOutflow, formatSigned, MONEY_MAX, parseMoneyInput, toInputText } from './money'

// O Intl separa "R$" do número com espaço não separável.
const NBSP = ' '

describe('formatMoney', () => {
  it('formata em reais', () => {
    expect(formatMoney(1234.56)).toBe(`R$${NBSP}1.234,56`)
    expect(formatMoney(0.5)).toBe(`R$${NBSP}0,50`)
  })

  it('trata 0 e -0 do mesmo jeito', () => {
    expect(formatMoney(0)).toBe(`R$${NBSP}0,00`)
    expect(formatMoney(-0)).toBe(`R$${NBSP}0,00`)
  })
})

describe('formatSigned', () => {
  it('mostra o sinal de receita e de gasto', () => {
    expect(formatSigned(3500)).toBe(`+R$${NBSP}3.500,00`)
    expect(formatSigned(-50.5)).toBe(`−R$${NBSP}50,50`)
  })

  it('não põe sinal no zero', () => {
    expect(formatSigned(0)).toBe(`R$${NBSP}0,00`)
  })
})

describe('formatOutflow', () => {
  it('põe o − na saída que já vem positiva', () => {
    expect(formatOutflow(2310.4)).toBe(`−R$${NBSP}2.310,40`)
    expect(formatOutflow(0)).toBe(`R$${NBSP}0,00`)
  })
})

describe('toInputText', () => {
  it('formata sem R$ e sempre positivo', () => {
    expect(toInputText(1234.5)).toBe('1.234,50')
    expect(toInputText(-800)).toBe('800,00')
    expect(toInputText(0.01)).toBe('0,01')
  })

  it('volta para o mesmo número', () => {
    for (const value of [0.01, 12.3, 1234.56, 1_000_000, MONEY_MAX]) {
      expect(parseMoneyInput(toInputText(value))).toBe(value)
    }
  })
})

describe('parseMoneyInput', () => {
  it.each([
    ['1.234,56', 1234.56],
    ['1234,56', 1234.56],
    ['1234,5', 1234.5],
    ['1234', 1234],
    ['0,01', 0.01],
    ['1.000.000', 1_000_000],
    ['  12,30 ', 12.3],
    ['R$ 1.234,56', 1234.56],
    ['0', 0],
    ['999.999.999.999,99', MONEY_MAX],
  ])('aceita "%s"', (text, expected) => {
    expect(parseMoneyInput(text)).toBe(expected)
  })

  it.each([
    [''],
    ['   '],
    ['abc'],
    ['0,001'],      // mais de 2 casas
    ['12.50'],      // ponto como decimal
    ['1.23,45'],    // grupo de milhar incompleto
    ['1,234.56'],   // formato americano
    ['-10'],
    ['10,'],
    [',50'],
    ['1 234,56'],
    ['1.000.000.000.000,00'], // acima do limite
  ])('recusa "%s"', (text) => {
    expect(parseMoneyInput(text)).toBeNull()
  })
})

describe('em inglês', () => {
  it('formata em reais com o separador americano', () => {
    expect(formatMoney(1234.56, 'en-US')).toBe('R$1,234.56')
    expect(formatMoney(-0, 'en-US')).toBe('R$0.00')
    expect(formatSigned(3500, 'en-US')).toBe('+R$3,500.00')
    expect(formatSigned(-50.5, 'en-US')).toBe('−R$50.50')
    expect(formatOutflow(2310.4, 'en-US')).toBe('−R$2,310.40')
    expect(toInputText(-1234.5, 'en-US')).toBe('1,234.50')
  })

  it.each([
    ['1,234.56', 1234.56],
    ['1234.56', 1234.56],
    ['1234.5', 1234.5],
    ['0.01', 0.01],
    ['1,000,000', 1_000_000],
    ['R$1,234.56', 1234.56],
    ['R$ 12.30', 12.3],
  ])('lê %s', (text, expected) => {
    expect(parseMoneyInput(text, 'en-US')).toBe(expected)
  })

  it.each(['1.234,56', '1234,56', '1,5', '12,34,567', '1.2.3', '1.234', '-10', '1.234.56'])('recusa %s', (text) => {
    expect(parseMoneyInput(text, 'en-US')).toBeNull()
  })

  it('volta para o mesmo número', () => {
    for (const value of [0.01, 12.3, 1234.56, 1_000_000, MONEY_MAX]) {
      expect(parseMoneyInput(toInputText(value, 'en-US'), 'en-US')).toBe(value)
    }
  })
})

describe('formatMoneyTyping', () => {
  it.each([
    ['', ''],
    ['5', '5'],
    ['5000', '5.000'],
    ['50000000', '50.000.000'],
    ['50.000.0000', '500.000.000'],
    ['1234,', '1.234,'],
    ['1234,5', '1.234,5'],
    ['1234,567', '1.234,56'],
    [',5', '0,5'],
    ['0005', '5'],
    ['0,05', '0,05'],
    ['12,3,4', '12,34'],
    ['1.2', '12'],
    ['R$ 1.234,56', '1.234,56'],
    ['abc', ''],
    ['9999999999999', '999.999.999.999'],
  ])('português: %s vira %s', (text, expected) => {
    expect(formatMoneyTyping(text, 'pt-BR')).toBe(expected)
  })

  it.each([
    ['50000000', '50,000,000'],
    ['1234.5', '1,234.5'],
    ['1,2', '12'],
    ['R$1,234.56', '1,234.56'],
  ])('inglês: %s vira %s', (text, expected) => {
    expect(formatMoneyTyping(text, 'en-US')).toBe(expected)
  })

  it('o resultado, com os centavos completos, é lido pelo parseMoneyInput', () => {
    expect(parseMoneyInput(formatMoneyTyping('50000000', 'pt-BR'), 'pt-BR')).toBe(50_000_000)
    expect(parseMoneyInput(formatMoneyTyping('1234,5', 'pt-BR'), 'pt-BR')).toBe(1234.5)
    expect(parseMoneyInput(formatMoneyTyping('1234.5', 'en-US'), 'en-US')).toBe(1234.5)
  })
})

describe('caretAfterTyping', () => {
  it('no fim, continua no fim mesmo com um ponto novo', () => {
    // "1.234" + "5" no fim: "1.2345" vira "12.345".
    expect(caretAfterTyping('1.2345', 6, '12.345', 'pt-BR')).toBe(6)
  })

  it('no meio, fica depois do dígito digitado', () => {
    // "1.234" com "9" depois do 1: "19.234" vira "19.234", cursor depois do 9.
    expect(caretAfterTyping('19.234', 2, '19.234', 'pt-BR')).toBe(2)
    // "12.345" com "6" depois do 2: "126.345" vira "126.345".
    expect(caretAfterTyping('126.345', 3, '126.345', 'pt-BR')).toBe(3)
    // "999" com "1" no começo: "1999" vira "1.999", cursor depois do 1.
    expect(caretAfterTyping('1999', 1, '1.999', 'pt-BR')).toBe(1)
  })

  it('apagando, o ponto que sobra não prende o cursor', () => {
    // "12.345" apagando o "2": "1.345" vira "1.345", cursor depois do 1.
    expect(caretAfterTyping('1.345', 1, '1.345', 'pt-BR')).toBe(1)
    // "1.234" apagando o "1": ".234" vira "234", cursor no começo.
    expect(caretAfterTyping('.234', 0, '234', 'pt-BR')).toBe(0)
  })

  it('nos centavos', () => {
    expect(caretAfterTyping('1.234,5', 7, '1.234,5', 'pt-BR')).toBe(7)
    expect(caretAfterTyping('1,234.5', 7, '1,234.5', 'en-US')).toBe(7)
  })
})
