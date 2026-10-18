/// <reference types="vitest/config" />
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
// Com a extensão: o carregador de configuração do Vite não resolve import sem ela.
import { APP_NAME } from './src/config/app.ts'
import { cspMeta } from './csp.ts'
import { VitePWA } from 'vite-plugin-pwa'

function appName(): Plugin {
  return {
    name: 'app-name',
    transformIndexHtml: {
      order: 'pre',
      handler: (html) => html.replaceAll('%APP_NAME%', APP_NAME),
    },
  }
}

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    appName(),
    // O service worker guarda só os arquivos do app, nunca /api. Atualização só com aviso.
    VitePWA({
      registerType: 'prompt',
      injectRegister: false,
      manifestFilename: 'manifest.webmanifest',
      includeAssets: [],
      manifest: {
        name: APP_NAME,
        short_name: APP_NAME,
        description: 'Controle financeiro pessoal',
        lang: 'pt-BR',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        background_color: '#12132A',
        theme_color: '#12132A',
        icons: [
          { src: '/mascote/kliny-icone-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/mascote/kliny-icone-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: '/mascote/kliny-icone-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,png,webp,webmanifest}'],
        globIgnores: ['**/mascote/kliny-calculadora-*', '**/mascote/kliny-cadeado-*', '**/kliny-compartilhar.png'],
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api(\/|$)/],
        // /api vai sempre para a rede.
        runtimeCaching: [],
        cleanupOutdatedCaches: true,
      },
    }),
    cspMeta(),
  ],
  server: {
    proxy: {
      '/api': 'http://localhost:5228',
    },
  },
  test: {
    // Fuso fixo: os testes de data dão o mesmo resultado em qualquer máquina.
    env: { TZ: 'America/Sao_Paulo' },
  },
})
