export const PASSWORD_MIN = 8
export const PASSWORD_MAX = 72

// O BCrypt só usa os primeiros 72 bytes em UTF-8: um "é" ocupa 2 bytes e um emoji, 4.
export const PASSWORD_MAX_BYTES = 72

export function utf8ByteLength(text: string): number {
  return new TextEncoder().encode(text).length
}

export function exceedsPasswordBytes(password: string): boolean {
  return utf8ByteLength(password) > PASSWORD_MAX_BYTES
}
