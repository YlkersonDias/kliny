// CSP do frontend (S.4), numa <meta> que só existe no build de produção: o servidor de
// desenvolvimento do Vite usa script inline e WebSocket, que uma política estrita quebraria.
// Os scripts inline do index.html (tema e idioma, que rodam antes do React para a tela não
// piscar) entram pelo hash, calculado aqui sobre o HTML final: mudou um script, o hash acompanha.
// O CI confere o resultado com scripts/check-csp.ts, que usa estas mesmas funções.
//
// Limitação da <meta>: o navegador ignora frame-ancestors nela. A proteção contra o app ser
// embutido em outro site entra como cabeçalho do servidor, na S.7 (lacuna registrada no CLAUDE.md).
import { createHash } from 'node:crypto'
import type { Plugin } from 'vite'

// <script> sem src: o conteúdo entre as tags é exatamente o que o navegador usa no hash.
const INLINE_SCRIPT = /<script\b(?![^>]*\bsrc\s*=)[^>]*>([\s\S]*?)<\/script>/gi
const META_CHARSET = /<meta\s+charset=[^>]*>/i
export const CSP_META = /<meta\s+http-equiv="Content-Security-Policy"\s+content="([^"]*)"\s*\/?>/i

export function inlineScriptHashes(html: string): string[] {
  return [...html.matchAll(INLINE_SCRIPT)].map(
    (match) => `'sha256-${createHash('sha256').update(match[1], 'utf8').digest('base64')}'`,
  )
}

export function contentSecurityPolicy(html: string): string {
  return [
    "default-src 'self'",
    ['script-src', "'self'", ...inlineScriptHashes(html)].join(' '),
    "style-src 'self'",
    "img-src 'self'",
    "connect-src 'self'",
    "font-src 'self'",
    "object-src 'none'",
    "base-uri 'none'",
    "form-action 'self'",
  ].join('; ')
}

// A <meta> entra logo depois do <meta charset>, antes de qualquer <script> do <head>.
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
      // Depois de tudo: o hash é sobre o HTML final, com o que o Vite e os outros plugins mudaram.
      order: 'post',
      handler: injectCspMeta,
    },
  }
}
