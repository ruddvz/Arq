// Root ESLint flat config - the whole repository lints from here (no
// per-package configs exist; `pnpm lint` runs `eslint .` at the root).
//
// The rule set is deliberately curated rather than "recommended": syntax-only
// (no type-aware linting, which tsc already covers via strict mode in every
// package), high-signal, and green against the current codebase - a lint
// gate that fails on real defects, not a permanently-red aspiration or the
// permanently-green no-op this file used to be.
import tseslint from 'typescript-eslint';

export default [
  {
    ignores: [
      '**/dist/**',
      '**/dist-build/**',
      '**/node_modules/**',
      '**/*.d.ts',
      '**/coverage/**',
      'rust/target/**',
      '**/pkg/**',
      'prototype/**', // standalone historical artifact, plain browser JS
      'component-harness/**', // static file:// harness, plain browser JS
      'design/**',
    ],
  },
  {
    files: ['**/*.ts', '**/*.tsx', '**/*.mjs', '**/*.js'],
    languageOptions: {
      parser: tseslint.parser,
      ecmaVersion: 2023,
      sourceType: 'module',
    },
    plugins: {
      '@typescript-eslint': tseslint.plugin,
    },
    rules: {
      // Correctness traps tsc does not catch.
      eqeqeq: ['error', 'always'],
      'no-debugger': 'error',
      'no-dupe-else-if': 'error',
      'no-duplicate-case': 'error',
      'no-self-compare': 'error',
      'no-template-curly-in-string': 'error',
      'no-unmodified-loop-condition': 'error',
      'no-unreachable-loop': 'error',
      'no-var': 'error',
      'prefer-const': 'error',
      'no-throw-literal': 'error',
      // Style-adjacent but defect-prone.
      'no-else-return': 'error',
      'no-useless-rename': 'error',
      'object-shorthand': 'error',
    },
  },
];
