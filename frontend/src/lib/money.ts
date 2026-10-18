import { currentLanguage } from '../i18n'
import type { Language } from './language'

// Dinheiro sempre em reais: "R$ 1.234,56" em português e "R$1,234.56" em inglês.

const currency: Record<Language, Intl.NumberFormat> = {
  'pt-BR': new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }),
  'en-US': new Intl.NumberFormat('en-US', { style: 'currency', currency: 'BRL' }),
}
const plain: Record<Language, Intl.NumberFormat> = {
  'pt-BR': new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
  'en-US': new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
}

// O number do JavaScript perde precisão acima de ~15 dígitos: o limite fica bem abaixo.
export const MONEY_MAX = 999_999_999_999.99

function normalize(value: number): number {
  return Object.is(value, -0) ? 0 : value
}

export function formatMoney(value: number, language: Language = currentLanguage()): string {
  return currency[language].format(normalize(value))
}

// Sinal explícito: receita e gasto não dependem só da cor.
export function formatSigned(value: number, language: Language = currentLanguage()): string {
  if (value > 0) return `+${formatMoney(value, language)}`
  if (value < 0) return `−${formatMoney(-value, language)}`
  return formatMoney(0, language)
}

// Para valores que já vêm positivos (o expense dos relatórios): só põe o "−" na frente.
export function formatOutflow(positive: number, language: Language = currentLanguage()): string {
  return positive === 0 ? formatMoney(0, language) : `−${formatMoney(positive, language)}`
}

export function toInputText(value: number, language: Language = currentLanguage()): string {
  return plain[language].format(Math.abs(normalize(value)))
}

const SEPARATORS: Record<Language, { decimal: string; group: string }> = {
  'pt-BR': { decimal: ',', group: '.' },
  'en-US': { decimal: '.', group: ',' },
}
const MAX_INTEGER_DIGITS = 12

// Pontos de milhar automáticos enquanto a pessoa digita; a vírgula dos centavos é ela quem põe.
// Não valida: quem confere é o parseMoneyInput.
export function formatMoneyTyping(text: string, language: Language = currentLanguage()): string {
  const { decimal, group } = SEPARATORS[language]
  const cleaned = text.replace(/^\s*R\$\s*/, '')
  const decimalAt = cleaned.indexOf(decimal)
  const integerDigits = (decimalAt === -1 ? cleaned : cleaned.slice(0, decimalAt)).replace(/\D/g, '')
  if (decimalAt === -1 && integerDigits === '') return ''

  const integer = (integerDigits.replace(/^0+(?=\d)/, '') || '0').slice(0, MAX_INTEGER_DIGITS)
  const grouped = integer.replace(/\B(?=(\d{3})+(?!\d))/g, group)
  if (decimalAt === -1) return grouped
  return `${grouped}${decimal}${cleaned.slice(decimalAt + 1).replace(/\D/g, '').slice(0, 2)}`
}

// O cursor fica com o mesmo número de dígitos à direita: a formatação só mexe à esquerda.
export function caretAfterTyping(raw: string, caret: number, formatted: string, language: Language = currentLanguage()): number {
  const { decimal, group } = SEPARATORS[language]
  const isSignificant = (char: string) => /\d/.test(char) || char === decimal
  let after = [...raw.slice(caret)].filter(isSignificant).length
  let position = formatted.length
  while (position > 0 && after > 0) {
    position--
    if (isSignificant(formatted[position])) after--
  }
  while (position > 0 && formatted[position - 1] === group) position--
  return position
}

const MONEY_PATTERN: Record<Language, { pattern: RegExp; group: string }> = {
  'pt-BR': { pattern: /^(\d{1,3}(?:\.\d{3})+|\d+)(?:,(\d{1,2}))?$/, group: '.' },
  'en-US': { pattern: /^(\d{1,3}(?:,\d{3})+|\d+)(?:\.(\d{1,2}))?$/, group: ',' },
}

// null para texto vazio, inválido, negativo, com mais de 2 casas ou acima de MONEY_MAX.
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
