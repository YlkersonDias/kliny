/// <reference types="vitest/config" />
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
// Com a extensão: o carregador nativo de configuração do Vite não resolve import sem ela.
import { APP_NAME } from './src/config/app.ts'

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
