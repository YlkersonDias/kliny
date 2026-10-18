import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import {
  contentSecurityPolicy, CSP_META, GOOGLE_GSI, GOOGLE_SCRIPT, GOOGLE_STYLE, injectCspMeta, inlineScriptHashes,
} from './csp.ts'

const HTML = `<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="UTF-8" />
    <title>Kliny</title>
    <script>
      document.documentElement.dataset.theme = 'dark'
    </script>
    <script>document.documentElement.lang = 'pt-BR'</script>
    <script type="module" crossorigin src="/assets/index-abc.js"></script>
    <link rel="stylesheet" crossorigin href="/assets/index-abc.css">
  </head>
  <body><div id="root"></div></body>
</html>`

function sha256(text: string): string {
  return `'sha256-${createHash('sha256').update(text, 'utf8').digest('base64')}'`
}

describe('inlineScriptHashes', () => {
  it('calcula o hash do conteúdo exato de cada script sem src, com espaços e quebras de linha', () => {
    expect(inlineScriptHashes(HTML)).toEqual([
      sha256("\n      document.documentElement.dataset.theme = 'dark'\n    "),
      sha256("document.documentElement.lang = 'pt-BR'"),
    ])
  })

  it('ignora scripts com src', () => {
    expect(inlineScriptHashes('<script type="module" src="/a.js"></script>')).toEqual([])
  })
})

describe('contentSecurityPolicy', () => {
  it('libera só a própria origem, os scripts inline pelo hash e nada de plugins nem <base>', () => {
    const policy = contentSecurityPolicy(HTML)
    expect(policy).toContain("default-src 'self'")
    expect(policy).toContain(`script-src 'self' ${GOOGLE_SCRIPT} ${inlineScriptHashes(HTML).join(' ')}`)
    expect(policy).toContain("object-src 'none'")
    expect(policy).toContain("base-uri 'none'")
    expect(policy).not.toContain('unsafe-inline')
    expect(policy).not.toContain('unsafe-eval')
    // Ignorado pelo navegador numa <meta>: vai no cabeçalho do nginx.
    expect(policy).not.toContain('frame-ancestors')
  })
})

describe('Google Identity Services', () => {
  it('libera só os endereços do Google que a documentação pede, cada um na sua diretiva', () => {
    const directives = Object.fromEntries(
      contentSecurityPolicy(HTML).split('; ').map((d) => [d.split(' ')[0], d.split(' ').slice(1)]),
    )
    expect(directives['script-src']).toContain('https://accounts.google.com/gsi/client')
    expect(directives['style-src']).toEqual(["'self'", 'https://accounts.google.com/gsi/style'])
    expect(directives['connect-src']).toEqual(["'self'", 'https://accounts.google.com/gsi/'])
    expect(directives['frame-src']).toEqual(['https://accounts.google.com/gsi/'])
    expect(directives['img-src']).toEqual(["'self'"])
    expect(GOOGLE_STYLE.startsWith(GOOGLE_GSI)).toBe(true)
  })

  it('o app carrega o script do Google exatamente do endereço liberado', () => {
    const loader = readFileSync('src/lib/googleIdentity.ts', 'utf8')
    expect(loader).toContain(`GOOGLE_SCRIPT = '${GOOGLE_SCRIPT}'`)
  })
})

describe('injectCspMeta', () => {
  it('põe a <meta> logo depois do charset e antes de qualquer script', () => {
    const html = injectCspMeta(HTML)
    const meta = html.match(CSP_META)
    expect(meta).not.toBeNull()
    expect(meta!.index!).toBeLessThan(html.search(/<script\b/))
    expect(meta!.index!).toBeGreaterThan(html.indexOf('<meta charset'))
    expect(meta![1]).toBe(contentSecurityPolicy(HTML))
  })

  it('a <meta> não muda os hashes, porque não é script', () => {
    expect(inlineScriptHashes(injectCspMeta(HTML))).toEqual(inlineScriptHashes(HTML))
  })

  it('recusa HTML sem charset e HTML que já tem CSP', () => {
    expect(() => injectCspMeta('<head><script>1</script></head>')).toThrow()
    expect(() => injectCspMeta(injectCspMeta(HTML))).toThrow()
  })
})
