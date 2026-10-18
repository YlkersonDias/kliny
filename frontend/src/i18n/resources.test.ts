import { describe, expect, it } from 'vitest'
import { resources } from './resources'

function flatten(value: unknown, prefix = ''): Record<string, string> {
  if (typeof value === 'string') return { [prefix]: value }
  const out: Record<string, string> = {}
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    Object.assign(out, flatten(child, prefix ? `${prefix}.${key}` : key))
  }
  return out
}

// Variáveis ({{name}}) e marcações do <Trans> (<name/>, <strong>), em ordem alfabética.
function placeholders(text: string): string[] {
  const vars = [...text.matchAll(/\{\{\s*(\w+)\s*\}\}/g)].map((m) => `{{${m[1]}}}`)
  const tags = [...text.matchAll(/<\/?(\w+)\s*\/?>/g)].map((m) => m[0])
  return [...vars, ...tags].sort()
}

const pt = flatten(resources['pt-BR'])
const en = flatten(resources['en-US'])

describe('textos em inglês', () => {
  it('tem exatamente as mesmas chaves do português', () => {
    expect(Object.keys(en).sort()).toEqual(Object.keys(pt).sort())
  })

  it('cada texto tem as mesmas variáveis e marcações do português', () => {
    for (const key of Object.keys(pt)) {
      expect({ key, placeholders: placeholders(en[key] ?? '') }).toEqual({ key, placeholders: placeholders(pt[key]) })
    }
  })

  it('nenhum texto vazio', () => {
    for (const [key, text] of Object.entries(en)) expect({ key, empty: text.trim() === '' }).toEqual({ key, empty: false })
  })
})
