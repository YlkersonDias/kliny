import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { THEME_COLORS } from './src/lib/themeColors.ts'

// A cor da barra (theme-color, 7.4) é o fundo das páginas de cada tema. Ela aparece em três
// lugares, que precisam bater: THEME_COLORS, o --color-background do index.css e o index.html.
describe('THEME_COLORS', () => {
  it('é o --color-background de cada tema no index.css (claro primeiro, depois o escuro)', () => {
    const css = readFileSync(new URL('./src/index.css', import.meta.url), 'utf8')
    const backgrounds = [...css.matchAll(/--color-background:\s*(#[0-9a-fA-F]{6})/g)].map((m) => m[1].toUpperCase())
    expect(backgrounds).toEqual([THEME_COLORS.light, THEME_COLORS.dark])
  })

  it('é a mesma do <meta name="theme-color"> e do script de tema do index.html', () => {
    const html = readFileSync(new URL('./index.html', import.meta.url), 'utf8')
    expect(html).toContain(`<meta name="theme-color" content="${THEME_COLORS.dark}" />`)
    expect(html).toContain(`dark ? '${THEME_COLORS.dark}' : '${THEME_COLORS.light}'`)
  })
})
