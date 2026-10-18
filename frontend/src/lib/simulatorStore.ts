import type { SimulatorForm } from './simulator'

// Só o que a pessoa digitou, com o Id de quem digitou: outra conta no mesmo navegador nunca vê.
// Some ao sair da conta.

const STORAGE_KEY = 'simulator.form'
const MAX_FIELD_LENGTH = 40

const TEXT_FIELDS = ['initial', 'monthly', 'rate', 'term'] as const

export function readSimulatorForm(userId: number): SimulatorForm | null {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null')
    if (!parsed || typeof parsed !== 'object') return null
    const { userId: owner, form } = parsed as { userId?: unknown; form?: Partial<Record<keyof SimulatorForm, unknown>> }
    if (owner !== userId || !form || typeof form !== 'object') return null
    const textsOk = TEXT_FIELDS.every((field) => typeof form[field] === 'string' && (form[field] as string).length <= MAX_FIELD_LENGTH)
    const unitsOk = (form.rateUnit === 'month' || form.rateUnit === 'year') && (form.termUnit === 'month' || form.termUnit === 'year')
    if (!textsOk || !unitsOk) return null
    return {
      initial: form.initial as string,
      monthly: form.monthly as string,
      rate: form.rate as string,
      rateUnit: form.rateUnit as SimulatorForm['rateUnit'],
      term: form.term as string,
      termUnit: form.termUnit as SimulatorForm['termUnit'],
    }
  } catch {
    return null
  }
}

export function saveSimulatorForm(userId: number, form: SimulatorForm): void {
  try {
    if (TEXT_FIELDS.every((field) => form[field].trim() === '')) {
      localStorage.removeItem(STORAGE_KEY)
      return
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ userId, form }))
  } catch {
    // Sem localStorage (bloqueado ou cheio): só não lembra.
  }
}

export function clearSimulatorForm(): void {
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    // Sem localStorage (bloqueado ou cheio): só não lembra.
  }
}
