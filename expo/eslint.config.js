const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['dist/*'],
  },
  {
    // New react-hooks v6 rules (SDK 57) flag the classic Animated useRef
    // patterns used throughout these screens. The code works; migrate screens
    // incrementally instead of blocking lint, then re-promote to errors.
    rules: {
      'react-hooks/refs': 'warn',
      'react-hooks/set-state-in-effect': 'warn',
    },
  },
  {
    files: ['**/__tests__/**', 'testing/**'],
    rules: {
      '@typescript-eslint/no-require-imports': 'off',
    },
  },
]);
