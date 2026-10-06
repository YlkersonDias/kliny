import { currentLanguage } from '../i18n'
import type { Language } from './language'

// Dinheiro: exibição em reais e leitura do valor digitado no formato do idioma da tela.
// A moeda é sempre o real: "R$ 1.234,56" em português e "R$1,234.56" em inglês. Trocar o idioma
// não converte valores. Cada função aceita o idioma (os testes passam os dois); sem ele, vale o da tela.

const currency: Record<Language, Intl.NumberFormat> = {
  'pt-BR': new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }),
  'en-US': new Intl.NumberFormat('en-US', { style: 'currency', currency: 'BRL' }),
}
const plain: Record<Language, Intl.NumberFormat> = {
  'pt-BR': new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
  'en-US': new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
}

// A API aceita até decimal(18,2), mas acima de ~15 dígitos o number do JavaScript perde
// precisão. Este limite (12 dígitos inteiros) fica bem abaixo dos dois.
export const MONEY_MAX = 999_999_999_999.99

// Sem o sinal de "-0" quando o valor arredonda para zero.
function normalize(value: number): number {
  return Object.is(value, -0) ? 0 : value
}

// R$ 1.234,56 (a API pode devolver 0 ou 0.00; os dois viram R$ 0,00).
export function formatMoney(value: number, language: Language = currentLanguage()): string {
  return currency[language].format(normalize(value))
}

// Valor com sinal explícito: receita e gasto não dependem só da cor.
export function formatSigned(value: number, language: Language = currentLanguage()): string {
  if (value > 0) return `+${formatMoney(value, language)}`
  if (value < 0) return `−${formatMoney(-value, language)}`
  return formatMoney(0, language)
}

// Saída que já vem positiva (o expense dos relatórios): só põe o "−" na frente, sem negar o número.
export function formatOutflow(positive: number, language: Language = currentLanguage()): string {
  return positive === 0 ? formatMoney(0, language) : `−${formatMoney(positive, language)}`
}

// Texto para o campo de valor, sem "R$" e sempre positivo: 1234.5 vira "1.234,50" (ou "1,234.50").
export function toInputText(value: number, language: Language = currentLanguage()): string {
  return plain[language].format(Math.abs(normalize(value)))
}

// Só dígitos, com ou sem separador de milhar em grupos de 3, e até 2 casas decimais.
// Português: 1.234,56. Inglês: 1,234.56 (a vírgula como decimal não é aceita).
const MONEY_PATTERN: Record<Language, { pattern: RegExp; group: string }> = {
  'pt-BR': { pattern: /^(\d{1,3}(?:\.\d{3})+|\d+)(?:,(\d{1,2}))?$/, group: '.' },
  'en-US': { pattern: /^(\d{1,3}(?:,\d{3})+|\d+)(?:\.(\d{1,2}))?$/, group: ',' },
}

// "1.234,56" (ou "1,234.56" em inglês) vira 1234.56. Devolve null para texto vazio, inválido,
// negativo, com mais de 2 casas ou acima de MONEY_MAX. Zero é aceito aqui; quem chama decide.
export function parseMoneyInput(text: string, language: Language = currentLanguage()): number | null {
  const { pattern, group } = MONEY_PATTERN[language]
  const cleaned = text.trim().replace(/^R\$\s*/, '')
  const match = pattern.exec(cleaned)
  if (!match) return null

  const integer = match[1].replaceAll(group, '')
  const cents = (match[2] ?? '').padEnd(2, '0')
  const value = Number(`${integer}.${cents}`)
  return value <= MONEY_MAX ? value : null
}
