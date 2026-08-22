import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: [
      'packages/*/src/**/*.test.ts',
      'apps/*/src/**/*.test.ts',
      'workers/*/src/**/*.test.ts',
      // Zeus operating-system tooling. `pnpm test` is the only Zeus-adjacent
      // check that runs in CI, so a Zeus suite collected here is enforced
      // rather than merely available: `pnpm zeus:test` is not wired into any
      // workflow (verified: `grep -rn zeus .github/workflows/` matches nothing).
      'scripts/**/*.test.ts',
    ],
    coverage: {
      reporter: ['text', 'html'],
      include: ['packages/*/src/**/*.ts', 'apps/*/src/**/*.ts', 'workers/*/src/**/*.ts'],
      exclude: ['**/*.test.ts'],
    },
  },
});
