import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import i18next from 'eslint-plugin-i18next'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
  },
  {
    // Texto da interface só pelo i18n (src/locales): acusa texto escrito direto no JSX e nas
    // props que viram texto na tela ou no leitor de tela.
    files: ['src/**/*.tsx'],
    plugins: { i18next },
    rules: {
      'i18next/no-literal-string': ['error', {
        mode: 'jsx-only',
        'jsx-attributes': {
          include: [
            'label', 'title', 'placeholder', 'aria-label', 'alt', 'hint', 'subtitle', 'description',
            'confirmLabel', 'tableLabel', 'totalLabel', 'itemsLabel',
          ],
        },
        // Opções substituem o padrão do plugin (não somam): as listas abaixo repetem o padrão.
        // Palavras: números, pontuação e símbolos soltos (" · ", "−", "404") e CONSTANTES.
        words: { exclude: ['[0-9!-/:-@[-`{-~\\s·−]+', '[A-Z_-]+'] },
        // Funções chamadas dentro do JSX com argumentos que não são texto (classes CSS, chaves).
        callees: {
          exclude: [
            'i18n(ext)?', 't', 'require', 'addEventListener', 'removeEventListener', 'postMessage',
            'getElementById', 'dispatch', 'commit', 'includes', 'indexOf', 'endsWith', 'startsWith',
            'settingsLink', 'kindOption',
          ],
        },
      }],
    },
  },
])
