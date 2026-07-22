import { describe, expect, it } from 'vitest';
import { worldPoint } from '@arq/geometry-2d';
import { pickBestSnap, SNAP_SOURCE_PRIORITY, type SnapResult } from './snap-result';

function result(source: SnapResult['source'], screenDistance: number): SnapResult {
  return {
    source,
    point: worldPoint(0, 0),
    priority: SNAP_SOURCE_PRIORITY[source],
    screenDistance,
  };
}

describe('SNAP_SOURCE_PRIORITY', () => {
  it('ranks endpoint highest and nearest lowest, matching the spec order', () => {
    expect(SNAP_SOURCE_PRIORITY.endpoint).toBeLessThan(SNAP_SOURCE_PRIORITY.intersection);
    expect(SNAP_SOURCE_PRIORITY.grid).toBeLessThan(SNAP_SOURCE_PRIORITY.nearest);
    expect(SNAP_SOURCE_PRIORITY.nearest).toBe(Math.max(...Object.values(SNAP_SOURCE_PRIORITY)));
  });
});

describe('pickBestSnap', () => {
  it('returns undefined for an empty list', () => {
    expect(pickBestSnap([])).toBeUndefined();
  });

  it('prefers the higher-priority source even when it is further away on screen', () => {
    const best = pickBestSnap([result('nearest', 1), result('endpoint', 9)]);
    expect(best?.source).toBe('endpoint');
  });

  it('breaks a priority tie by screen distance', () => {
    const best = pickBestSnap([result('midpoint', 9), result('midpoint', 2)]);
    expect(best?.screenDistance).toBe(2);
  });

  it('does not mutate the input array', () => {
    const input = [result('grid', 5), result('endpoint', 5)];
    const copy = [...input];
    pickBestSnap(input);
    expect(input).toEqual(copy);
  });
});
