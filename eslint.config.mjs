// eslint.config.mjs
import js from '@eslint/js'
import tseslint from 'typescript-eslint'
import prettier from 'eslint-plugin-prettier'
import eslintConfigPrettier from 'eslint-config-prettier'

export default [
  {
    ignores: ['prettier.config.cjs', 'eslint.config.mjs'],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
      },
    },
    plugins: {
      prettier,
    },
    rules: {
      'prettier/prettier': 'warn',
    },
  },
  eslintConfigPrettier,
]
