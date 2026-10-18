// Confere, no build, que a <meta> da CSP vem antes do primeiro <script> e que o script-src tem
// exatamente os hashes dos scripts inline. Uso: npm run check:csp (depois do npm run build).
import { readFileSync } from 'node:fs'
import { CSP_META, inlineScriptHashes } from '../csp.ts'

const html = readFileSync(new URL('../dist/index.html', import.meta.url), 'utf8')
const errors: string[] = []

const meta = html.match(CSP_META)
if (!meta || meta.index === undefined) {
  errors.push('dist/index.html sem a <meta> de Content-Security-Policy.')
} else {
  const firstScript = html.search(/<script\b/i)
  if (firstScript !== -1 && firstScript < meta.index) errors.push('A <meta> da CSP vem depois de um <script>.')

  const scriptSrc = meta[1].split(';').map((part) => part.trim()).find((part) => part.startsWith('script-src '))
  const allowed = new Set(scriptSrc?.split(/\s+/).filter((token) => token.startsWith("'sha256-")) ?? [])
  const expected = inlineScriptHashes(html)
  for (const hash of expected) if (!allowed.has(hash)) errors.push(`Script inline sem o hash ${hash} na CSP.`)
  for (const hash of allowed) if (!expected.includes(hash)) errors.push(`Hash ${hash} na CSP sem script inline correspondente.`)
  if (expected.length === 0) errors.push('Nenhum script inline encontrado: o index.html mudou? Revisar a CSP.')
}

if (errors.length > 0) {
  for (const error of errors) console.error(`CSP: ${error}`)
  process.exit(1)
}
console.log(`CSP conferida: <meta> antes dos scripts e ${inlineScriptHashes(html).length} hashes corretos.`)
