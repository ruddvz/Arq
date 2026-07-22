import { describe, expect, it } from 'vitest';
import { worldPoint } from '@arq/geometry-2d';
import { pickBestSnap, SNAP_SOURCE_PRIORITY, type SnapResult } from './snap-result';
import { combineSnapSources } from './snap-tie-break';

function result(
  source: SnapResult['source'],
  screenDistance: number,
  point = worldPoint(0, 0),
): SnapResult {
  return { source, point, priority: SNAP_SOURCE_PRIORITY[source], screenDistance };
}

describe('combineSnapSources', () => {
  it('flattens multiple per-source arrays into one', () => {
    const endpoints = [result('endpoint', 3)];
    const midpoints = [result('midpoint', 1), result('midpoint', 5)];
    expect(combineSnapSources(endpoints, midpoints)).toEqual([...endpoints, ...midpoints]);
  });

  it('handles a mix of empty and non-empty source arrays', () => {
    expect(combineSnapSources([], [result('grid', 2)], [])).toEqual([result('grid', 2)]);
  });
});

describe('snap tie-break rules end to end (pickBestSnap over combined sources)', () => {
  it('picks the highest-priority source across combined results', () => {
    const combined = combineSnapSources([result('nearest', 0)], [result('endpoint', 9)]);
    expect(pickBestSnap(combined)?.source).toBe('endpoint');
  });

  it('breaks a same-priority tie by screen distance', () => {
    const combined = combineSnapSources(
      [result('midpoint', 8, worldPoint(1, 1))],
      [result('midpoint', 2, worldPoint(2, 2))],
    );
    expect(pickBestSnap(combined)?.point).toEqual(worldPoint(2, 2));
  });

  it('resolves an exact priority-and-distance tie by keeping the earlier-listed result (stable sort)', () => {
    const first = result('grid', 4, worldPoint(1, 0));
    const second = result('grid', 4, worldPoint(2, 0));
    expect(pickBestSnap(combineSnapSources([first], [second]))).toBe(first);
    // order matters: listing `second` first makes it win instead, proving
    // this is genuine list-order stability, not an accidental match on `first`.
    expect(pickBestSnap(combineSnapSources([second], [first]))).toBe(second);
  });
});
