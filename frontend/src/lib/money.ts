// Dinheiro: exibição em reais e leitura do valor digitado no formato brasileiro (1.234,56).

const currency = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
const plain = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

// A API aceita até decimal(18,2), mas acima de ~15 dígitos o number do JavaScript perde
// precisão. Este limite (12 dígitos inteiros) fica bem abaixo dos dois.
export const MONEY_MAX = 999_999_999_999.99

// Sem o sinal de "-0" quando o valor arredonda para zero.
function normalize(value: number): number {
  return Object.is(value, -0) ? 0 : value
}

// R$ 1.234,56 (a API pode devolver 0 ou 0.00; os dois viram R$ 0,00).
export function formatMoney(value: number): string {
  return currency.format(normalize(value))
}

// Valor com sinal explícito: receita e gasto não dependem só da cor.
export function formatSigned(value: number): string {
  if (value > 0) return `+${formatMoney(value)}`
  if (value < 0) return `−${formatMoney(-value)}`
  return formatMoney(0)
}

// Texto para o campo de valor, sem "R$" e sempre positivo: 1234.5 vira "1.234,50".
export function toInputText(value: number): string {
  return plain.format(Math.abs(normalize(value)))
}

// Só dígitos, com ou sem pontos de milhar em grupos de 3, e até 2 casas depois da vírgula.
const MONEY_PATTERN = /^(\d{1,3}(?:\.\d{3})+|\d+)(?:,(\d{1,2}))?$/

// "1.234,56" vira 1234.56. Devolve null para texto vazio, inválido, negativo,
// com mais de 2 casas ou acima de MONEY_MAX. Zero é aceito aqui; quem chama decide.
export function parseMoneyInput(text: string): number | null {
  const cleaned = text.trim().replace(/^R\$\s*/, '')
  const match = MONEY_PATTERN.exec(cleaned)
  if (!match) return null

  const integer = match[1].replaceAll('.', '')
  const cents = (match[2] ?? '').padEnd(2, '0')
  const value = Number(`${integer}.${cents}`)
  return value <= MONEY_MAX ? value : null
}
