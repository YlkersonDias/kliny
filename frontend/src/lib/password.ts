// O BCrypt da API só usa os primeiros 72 bytes da senha em UTF-8 (S.6): um "é" ocupa 2 bytes e um
// emoji, 4. Mesmo limite do MaxUtf8Bytes do RegisterRequest e do LoginRequest.
export const PASSWORD_MAX_BYTES = 72

export function utf8ByteLength(text: string): number {
  return new TextEncoder().encode(text).length
}

export function exceedsPasswordBytes(password: string): boolean {
  return utf8ByteLength(password) > PASSWORD_MAX_BYTES
}
