import { describe, expect, it } from 'vitest'
import { lerp, screenOffset, tourHeight, tourProgress } from './landingMotion'

describe('tourProgress', () => {
  it('vai de 0 a 1 enquanto a seção passa presa na tela', () => {
    expect(tourProgress(100, 2000, 800)).toBe(0)
    expect(tourProgress(0, 2000, 800)).toBe(0)
    expect(tourProgress(-600, 2000, 800)).toBe(0.5)
    expect(tourProgress(-1200, 2000, 800)).toBe(1)
    expect(tourProgress(-3000, 2000, 800)).toBe(1)
  })

  it('seção que cabe na tela não anda', () => {
    expect(tourProgress(-100, 600, 800)).toBe(0)
  })
})

describe('tourHeight', () => {
  it('a sobra da trilha mais uma tela', () => {
    expect(tourHeight(2500, 1300, 800)).toBe(2000)
    expect(tourHeight(900, 1300, 800)).toBe(800)
  })
})

describe('screenOffset', () => {
  it('0 no meio da tela, negativo acima e positivo abaixo, limitado a 1', () => {
    expect(screenOffset(300, 200, 800)).toBe(0)
    expect(screenOffset(-100, 200, 800)).toBe(-0.5)
    expect(screenOffset(5000, 200, 800)).toBe(1)
  })
})

describe('lerp', () => {
  it('anda uma fração do caminho', () => {
    expect(lerp(0, 100, 0.25)).toBe(25)
    expect(lerp(100, 100)).toBe(100)
  })
})
