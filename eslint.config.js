// eslint.config.js (root)
import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  // ignore build artifacts globally
  globalIgnores(['dist', 'build', 'coverage', 'functions/lib', 'functions/node_modules']),

  // 1) Default: your React app (browser + ESM)
  {
    files: ['**/*.{js,jsx,ts,tsx}'],
    ignores: ['functions/**'], // keep the react/browser rules out of the Firebase functions folder
    extends: [
      js.configs.recommended,
      reactHooks.configs['recommended-latest'],
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2022,
      globals: globals.browser,
      parserOptions: {
        ecmaVersion: 'latest',
        ecmaFeatures: { jsx: true },
        sourceType: 'module',
      },
    },
    rules: {
      'no-unused-vars': ['error', { varsIgnorePattern: '^[A-Z_]' }],
    },
  },

  // 2) Override for Firebase Cloud Functions (Node + CommonJS)
  {
    files: ['functions/**/*.{js,cjs}'],
    extends: [js.configs.recommended],
    languageOptions: {
      ecmaVersion: 2021,
      sourceType: 'script',                // CommonJS
      globals: {
        ...globals.node,                   // process, __dirname, etc.
        require: 'readonly',
        module: 'readonly',
        exports: 'readonly',
      },
    },
    rules: {
      // allow unused args like "_context" in onCall handlers
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      // you can add Node-specific tweaks here if needed
    },
  },
])
