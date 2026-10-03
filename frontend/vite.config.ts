import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { APP_NAME } from './src/config/app'

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
})
