import { describe, expect, it } from 'vitest'
import { exceedsPasswordBytes, utf8ByteLength } from './password'

describe('utf8ByteLength', () => {
  it('conta bytes em UTF-8, e não caracteres', () => {
    expect(utf8ByteLength('abc')).toBe(3)
    expect(utf8ByteLength('é')).toBe(2)
    expect(utf8ByteLength('🔒')).toBe(4)
  })
})

describe('exceedsPasswordBytes', () => {
  it('aceita até 72 bytes e recusa acima, mesmo com menos de 72 caracteres', () => {
    expect(exceedsPasswordBytes('a'.repeat(72))).toBe(false)
    expect(exceedsPasswordBytes('é'.repeat(36))).toBe(false)
    expect(exceedsPasswordBytes('é'.repeat(37))).toBe(true)
    expect(exceedsPasswordBytes('a'.repeat(69) + '🔒')).toBe(true)
  })
})
