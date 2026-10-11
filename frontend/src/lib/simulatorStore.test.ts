import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { SimulatorForm } from './simulator'
import { clearSimulatorForm, readSimulatorForm, saveSimulatorForm } from './simulatorStore'

const FORM: SimulatorForm = { initial: '20.000,00', monthly: '500,00', rate: '12', rateUnit: 'year', term: '5', termUnit: 'year' }
let store: Map<string, string>

beforeEach(() => {
  store = new Map()
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => void store.set(key, value),
    removeItem: (key: string) => void store.delete(key),
  })
})

afterEach(() => vi.unstubAllGlobals())

describe('simulatorStore', () => {
  it('guarda e devolve os valores da mesma conta', () => {
    saveSimulatorForm(7, FORM)
    expect(readSimulatorForm(7)).toEqual(FORM)
  })

  it('outra conta no mesmo navegador não vê a simulação', () => {
    saveSimulatorForm(7, FORM)
    expect(readSimulatorForm(8)).toBeNull()
  })

  it('sair da conta apaga', () => {
    saveSimulatorForm(7, FORM)
    clearSimulatorForm()
    expect(readSimulatorForm(7)).toBeNull()
    expect(store.size).toBe(0)
  })

  it('com os campos vazios, não guarda nada', () => {
    saveSimulatorForm(7, FORM)
    saveSimulatorForm(7, { ...FORM, initial: '', monthly: ' ', rate: '', term: '' })
    expect(store.size).toBe(0)
  })

  it('lixo guardado é ignorado', () => {
    for (const value of ['nada', '[]', '{"userId":7}', '{"userId":7,"form":{"initial":1}}',
      JSON.stringify({ userId: 7, form: { ...FORM, rateUnit: 'day' } }),
      JSON.stringify({ userId: 7, form: { ...FORM, rate: 'x'.repeat(41) } })]) {
      store.set('simulator.form', value)
      expect(readSimulatorForm(7)).toBeNull()
    }
  })

  it('com o localStorage bloqueado, só não lembra', () => {
    const blocked = () => { throw new Error('SecurityError') }
    vi.stubGlobal('localStorage', { getItem: blocked, setItem: blocked, removeItem: blocked })
    expect(() => saveSimulatorForm(7, FORM)).not.toThrow()
    expect(() => clearSimulatorForm()).not.toThrow()
    expect(readSimulatorForm(7)).toBeNull()
  })
})
