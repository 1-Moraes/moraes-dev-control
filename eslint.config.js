import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{js,jsx}'],
    extends: [
      js.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      globals: globals.browser,
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
  },
  {
    // Código que roda só do lado do servidor (Vercel Functions e os
    // módulos que elas importam) ou em testes Vitest (ambiente Node) —
    // precisa de `process`/`global`, que não existem no bundle de
    // frontend. Nunca inclui src/pages, src/components nem src/lib fora
    // destas pastas, pra não aceitar acidentalmente `process`/`global` em
    // código que de fato roda no navegador.
    files: [
      'api/**/*.js',
      'src/lib/radar/DiscoveryService.js',
      'src/lib/radar/providers/**/*.js',
      'src/lib/ai/AIOrchestrator.js',
      'src/lib/ai/autenticacaoServidor.js',
      'src/lib/ai/limites.js',
      'src/lib/ai/providers/**/*.js',
      '**/__tests__/**/*.js',
    ],
    languageOptions: {
      globals: { ...globals.node, ...globals.vitest },
    },
  },
])
