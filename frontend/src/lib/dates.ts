// Datas como texto YYYY-MM-DD, igual à API.
// Nunca usar new Date("2026-10-02"): o JavaScript lê como meia-noite UTC e,
// no Brasil, isso mostra o dia anterior. "Hoje" usa a data local do navegador.

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

// Calculado à mão: new Date(ano, ...) trata anos de 0 a 99 como 1900 a 1999.
function daysInMonth(year: number, month: number): number {
  if (month === 2) return isLeapYear(year) ? 29 : 28
  return [4, 6, 9, 11].includes(month) ? 30 : 31
}

// Data local (e não UTC) de um Date.
export function toIsoDate(date: Date): string {
  return `${pad(date.getFullYear(), 4)}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

export function today(now: Date = new Date()): string {
  return toIsoDate(now)
}

// Do dia 1 ao último dia do mês atual.
export function currentMonthRange(now: Date = new Date()): DateRange {
  const year = now.getFullYear()
  const month = now.getMonth() + 1
  return {
    from: `${pad(year, 4)}-${pad(month)}-01`,
    to: `${pad(year, 4)}-${pad(month)}-${pad(daysInMonth(year, month))}`,
  }
}

// Mesmo intervalo da coluna date do MySQL e do DateOnly do .NET.
export function isValidIsoDate(text: string): boolean {
  const match = ISO_PATTERN.exec(text)
  if (!match) return false
  const [year, month, day] = match.slice(1).map(Number)
  return year >= 1 && month >= 1 && month <= 12 && day >= 1 && day <= daysInMonth(year, month)
}

const monthYear = new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' })

// "2026-10-02" vira "Outubro de 2026". O Date é montado com números (hora local), nunca com o texto.
export function formatMonthYear(iso: string): string {
  const match = ISO_PATTERN.exec(iso)
  if (!match) return iso
  const date = new Date(2000, Number(match[2]) - 1, 1)
  date.setFullYear(Number(match[1]))
  const text = monthYear.format(date)
  return text.charAt(0).toUpperCase() + text.slice(1)
}

const longDate = new Intl.DateTimeFormat('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' })

// "2026-10-05" vira "5 de outubro de 2026" (sem dia da semana). Como no formatMonthYear, o Date
// é montado com números (hora local), nunca com o texto.
export function formatLongDate(iso: string): string {
  if (!isValidIsoDate(iso)) return iso
  const date = new Date(2000, Number(iso.slice(5, 7)) - 1, Number(iso.slice(8, 10)))
  date.setFullYear(Number(iso.slice(0, 4)))
  return longDate.format(date)
}

// Instante da API (createdAt, em UTC com "Z") para a data local do navegador: "2026-10-06T01:30:00Z"
// é 05/10/2026 no Brasil. Sem fuso no texto, trata como UTC (é como o backend grava).
export function formatTimestampDate(timestamp: string): string {
  const withZone = /(Z|[+-]\d{2}:\d{2})$/.test(timestamp) ? timestamp : `${timestamp}Z`
  const date = new Date(withZone)
  return Number.isNaN(date.getTime()) ? '' : formatDate(toIsoDate(date))
}

// "2026-10-02" vira "02/10/2026". Texto fora do formato volta como veio.
export function formatDate(iso: string): string {
  const match = ISO_PATTERN.exec(iso)
  return match ? `${match[3]}/${match[2]}/${match[1]}` : iso
}
