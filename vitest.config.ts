import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: [
      'packages/*/src/**/*.test.ts',
      'apps/*/src/**/*.test.ts',
      'workers/*/src/**/*.test.ts',
    ],
    coverage: {
      reporter: ['text', 'html'],
      include: ['packages/*/src/**/*.ts', 'apps/*/src/**/*.ts', 'workers/*/src/**/*.ts'],
      exclude: ['**/*.test.ts'],
    },
  },
});
