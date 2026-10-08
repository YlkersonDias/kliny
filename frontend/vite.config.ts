/// <reference types="vitest/config" />
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
// Com a extensão: o carregador nativo de configuração do Vite não resolve import sem ela.
import { APP_NAME } from './src/config/app.ts'
import { cspMeta } from './csp.ts'
import { VitePWA } from 'vite-plugin-pwa'

// Substitui %APP_NAME% no index.html pela mesma constante usada nos componentes.
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
    // PWA (7.4), só no build. O service worker guarda só os arquivos do app: nada de /api
    // (regra 14). Atualização com aviso (registerType 'prompt', ver components/ui/UpdatePrompt.tsx),
    // para nunca recarregar com um formulário preenchido. O registro sai do bundle (injectRegister
    // false), sem script inline, então a CSP não muda.
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
        // O padrão do app é o tema escuro (THEME_COLORS.dark em src/lib/theme.ts).
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
        // App de uma página: navegação offline cai no index.html, menos /api.
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api(\/|$)/],
        // Nenhuma regra de cache em tempo de execução: o que não é arquivo do build (como /api)
        // vai sempre para a rede e nunca é guardado.
        runtimeCaching: [],
        cleanupOutdatedCaches: true,
      },
    }),
    // Só no build; o hash dos scripts inline é sobre o HTML final (ver csp.ts).
    cspMeta(),
  ],
  server: {
    // Em desenvolvimento a API fica na mesma origem, sem precisar de CORS.
    proxy: {
      '/api': 'http://localhost:5228',
    },
  },
  test: {
    // Fuso fixo: os testes de data devem dar o mesmo resultado em qualquer máquina.
    env: { TZ: 'America/Sao_Paulo' },
  },
})
