import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');

describe('workspace registry executable validator', () => {
  it('runs the repository registry validator even when later CI steps are skipped', () => {
    expect(() =>
      execFileSync(process.execPath, ['scripts/check-workspace-registries.mjs'], {
        cwd: repoRoot,
        stdio: 'pipe',
      }),
    ).not.toThrow();
  });
});
