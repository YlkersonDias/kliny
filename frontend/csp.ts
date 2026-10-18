// Só no build: o servidor de desenvolvimento usa script inline e WebSocket. O hash dos scripts
// inline é calculado sobre o HTML final.
import { createHash } from 'node:crypto'
import type { Plugin } from 'vite'

const INLINE_SCRIPT = /<script\b(?![^>]*\bsrc\s*=)[^>]*>([\s\S]*?)<\/script>/gi
const META_CHARSET = /<meta\s+charset=[^>]*>/i
export const CSP_META = /<meta\s+http-equiv="Content-Security-Policy"\s+content="([^"]*)"\s*\/?>/i

export function inlineScriptHashes(html: string): string[] {
  return [...html.matchAll(INLINE_SCRIPT)].map(
    (match) => `'sha256-${createHash('sha256').update(match[1], 'utf8').digest('base64')}'`,
  )
}

// Só os endereços que a documentação do Google Identity Services pede.
export const GOOGLE_SCRIPT = 'https://accounts.google.com/gsi/client'
export const GOOGLE_STYLE = 'https://accounts.google.com/gsi/style'
export const GOOGLE_GSI = 'https://accounts.google.com/gsi/'

export function contentSecurityPolicy(html: string): string {
  return [
    "default-src 'self'",
    ['script-src', "'self'", GOOGLE_SCRIPT, ...inlineScriptHashes(html)].join(' '),
    `style-src 'self' ${GOOGLE_STYLE}`,
    "img-src 'self'",
    `connect-src 'self' ${GOOGLE_GSI}`,
    `frame-src ${GOOGLE_GSI}`,
    "font-src 'self'",
    "object-src 'none'",
    "base-uri 'none'",
    "form-action 'self'",
  ].join('; ')
}

export function injectCspMeta(html: string): string {
  if (CSP_META.test(html)) throw new Error('O index.html já tem uma <meta> de CSP.')
  const charset = html.match(META_CHARSET)
  if (!charset || charset.index === undefined) throw new Error('O index.html precisa de <meta charset> para a CSP entrar logo depois.')
  const end = charset.index + charset[0].length
  const meta = `\n    <meta http-equiv="Content-Security-Policy" content="${contentSecurityPolicy(html)}" />`
  return html.slice(0, end) + meta + html.slice(end)
}

export function cspMeta(): Plugin {
  return {
    name: 'csp-meta',
    apply: 'build',
    transformIndexHtml: {
      order: 'post',
      handler: injectCspMeta,
    },
  }
}
