import { describe, expect, it } from 'vitest'
import { newIdempotencyKey, type RandomSource } from './idempotency'

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
const API_FORMAT = /^[A-Za-z0-9_-]{1,64}$/

describe('newIdempotencyKey', () => {
  it('gera um UUID v4 no formato aceito pela API', () => {
    const key = newIdempotencyKey()
    expect(key).toMatch(UUID_V4)
    expect(key).toMatch(API_FORMAT)
  })

  it('gera uma chave diferente a cada chamada', () => {
    const keys = new Set(Array.from({ length: 1000 }, () => newIdempotencyKey()))
    expect(keys.size).toBe(1000)
  })

  it('sem randomUUID (fora de contexto seguro), monta o UUID com getRandomValues', () => {
    const fallback: RandomSource = { getRandomValues: (array) => crypto.getRandomValues(array) }
    const key = newIdempotencyKey(fallback)
    expect(key).toMatch(UUID_V4)
    expect(newIdempotencyKey(fallback)).not.toBe(key)
  })

  it('marca a versão e a variante mesmo com bytes extremos', () => {
    const allOnes: RandomSource = { getRandomValues: (array) => array.fill(0xff) }
    expect(newIdempotencyKey(allOnes)).toBe('ffffffff-ffff-4fff-bfff-ffffffffffff')
  })
})
