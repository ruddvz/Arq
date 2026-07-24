import { describe, expect, it } from 'vitest';
import { OPEN_STAGES, descriptor } from './stages';

describe('OPEN_STAGES', () => {
  it('has exactly six stages, 0 through 5, in order', () => {
    expect(OPEN_STAGES.map((s) => s.stage)).toEqual([0, 1, 2, 3, 4, 5]);
  });

  it('marks stages 0-3 blocking and 4-5 non-blocking', () => {
    expect(OPEN_STAGES.filter((s) => s.blocking).map((s) => s.stage)).toEqual([0, 1, 2, 3]);
    expect(OPEN_STAGES.filter((s) => !s.blocking).map((s) => s.stage)).toEqual([4, 5]);
  });
});

describe('descriptor', () => {
  it('finds the descriptor for a known stage', () => {
    expect(descriptor(3).name).toBe('Authoring');
  });

  it('throws for an out-of-range stage value', () => {
    // @ts-expect-error - deliberately out of range to test the runtime guard.
    expect(() => descriptor(9)).toThrow(/unknown open stage/);
  });
});
