import { describe, expect, it } from 'vitest';
import { GenerationGuard } from './generation-guard';

describe('GenerationGuard', () => {
  it('rejects a superseded generation as stale', () => {
    const guard = new GenerationGuard();
    const old = guard.begin('view');
    const current = guard.begin('view');

    expect(guard.isCurrent(old)).toBe(false);
    expect(guard.isCurrent(current)).toBe(true);
  });

  it('tracks each target independently', () => {
    const guard = new GenerationGuard();
    const viewToken = guard.begin('view');
    const sheetToken = guard.begin('sheet');

    expect(guard.isCurrent(viewToken)).toBe(true);
    expect(guard.isCurrent(sheetToken)).toBe(true);
  });

  it('assertCurrent throws for a stale token and passes for the current one', () => {
    const guard = new GenerationGuard();
    const old = guard.begin('view');
    const current = guard.begin('view');

    expect(() => guard.assertCurrent(old)).toThrow(/stale generation/);
    expect(() => guard.assertCurrent(current)).not.toThrow();
  });

  it('cancel invalidates the current token without starting a new one', () => {
    const guard = new GenerationGuard();
    const current = guard.begin('view');

    guard.cancel('view');

    expect(guard.isCurrent(current)).toBe(false);
  });
});
