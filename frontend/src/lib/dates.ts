// Datas como texto YYYY-MM-DD, igual à API. Nunca usar new Date("2026-10-02"): o JavaScript lê
// como meia-noite UTC e, no Brasil, mostra o dia anterior.

import { currentLanguage } from '../i18n'
import type { Language } from './language'

export interface DateRange {
  from: string
  to: string
}

const ISO_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/

function pad(value: number, length = 2): string {
  return String(value).padStart(length, '0')
}

function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0
}

// À mão: new Date(ano, ...) trata anos de 0 a 99 como 1900 a 1999.
function daysInMonth(year: number, month: number): number {
  if (month === 2) return isLeapYear(year) ? 29 : 28
  return [4, 6, 9, 11].includes(month) ? 30 : 31
}

export function toIsoDate(date: Date): string {
  return `${pad(date.getFullYear(), 4)}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

export function today(now: Date = new Date()): string {
  return toIsoDate(now)
}

export function currentMonthRange(now: Date = new Date()): DateRange {
  const year = now.getFullYear()
  const month = now.getMonth() + 1
  return {
    from: `${pad(year, 4)}-${pad(month)}-01`,
    to: `${pad(year, 4)}-${pad(month)}-${pad(daysInMonth(year, month))}`,
  }
}

// O intervalo da coluna date do MySQL e do DateOnly do .NET.
export function isValidIsoDate(text: string): boolean {
  const match = ISO_PATTERN.exec(text)
  if (!match) return false
  const [year, month, day] = match.slice(1).map(Number)
  return year >= 1 && month >= 1 && month <= 12 && day >= 1 && day <= daysInMonth(year, month)
}

// No mesmo dia; num mês mais curto, o último dia dele (31/01 + 1 mês = 28/02), como na API.
export function addMonthsClamped(iso: string, months: number): string {
  const [year, month, day] = iso.split('-').map(Number)
  const index = year * 12 + (month - 1) + months
  const newYear = Math.floor(index / 12)
  const newMonth = (index % 12) + 1
  return `${pad(newYear, 4)}-${pad(newMonth)}-${pad(Math.min(day, daysInMonth(newYear, newMonth)))}`
}

const monthYear: Record<Language, Intl.DateTimeFormat> = {
  'pt-BR': new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' }),
  'en-US': new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' }),
}

export function formatMonthYear(iso: string, language: Language = currentLanguage()): string {
  const match = ISO_PATTERN.exec(iso)
  if (!match) return iso
  const date = new Date(2000, Number(match[2]) - 1, 1)
  date.setFullYear(Number(match[1]))
  const text = monthYear[language].format(date)
  return text.charAt(0).toUpperCase() + text.slice(1)
}

const longDate: Record<Language, Intl.DateTimeFormat> = {
  'pt-BR': new Intl.DateTimeFormat('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' }),
  'en-US': new Intl.DateTimeFormat('en-US', { day: 'numeric', month: 'long', year: 'numeric' }),
}

export function formatLongDate(iso: string, language: Language = currentLanguage()): string {
  if (!isValidIsoDate(iso)) return iso
  const date = new Date(2000, Number(iso.slice(5, 7)) - 1, Number(iso.slice(8, 10)))
  date.setFullYear(Number(iso.slice(0, 4)))
  return longDate[language].format(date)
}

// Instante da API (UTC) para a data local: "2026-10-06T01:30:00Z" é 05/10 no Brasil.
export function formatTimestampDate(timestamp: string, language: Language = currentLanguage()): string {
  const withZone = /(Z|[+-]\d{2}:\d{2})$/.test(timestamp) ? timestamp : `${timestamp}Z`
  const date = new Date(withZone)
  return Number.isNaN(date.getTime()) ? '' : formatDate(toIsoDate(date), language)
}

export function formatDate(iso: string, language: Language = currentLanguage()): string {
  const match = ISO_PATTERN.exec(iso)
  if (!match) return iso
  const [, year, month, day] = match
  return language === 'en-US' ? `${month}/${day}/${year}` : `${day}/${month}/${year}`
}
