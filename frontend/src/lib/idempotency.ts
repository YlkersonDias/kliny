// Chave Idempotency-Key do depósito e da retirada (regra 18 de "Segurança (obrigatória)"):
// um UUID v4 por intenção de operação. Reenviar com a mesma chave não cria um segundo lançamento.
// O crypto.randomUUID só existe em contexto seguro (HTTPS ou localhost); fora dele, o UUID é
// montado com crypto.getRandomValues, que existe em todo lugar.
export interface RandomSource {
  getRandomValues(array: Uint8Array<ArrayBuffer>): Uint8Array<ArrayBuffer>
  randomUUID?: () => string
}

export function newIdempotencyKey(source: RandomSource = crypto): string {
  if (typeof source.randomUUID === 'function') return source.randomUUID()

  const bytes = source.getRandomValues(new Uint8Array(16))
  bytes[6] = (bytes[6] & 0x0f) | 0x40 // versão 4
  bytes[8] = (bytes[8] & 0x3f) | 0x80 // variante RFC 4122
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}
