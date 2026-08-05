import { describe, expect, it } from 'vitest';
import {
  rankCandidates,
  resolveInference,
  cycleInference,
  suppressSource,
  unsuppressSource,
  clearInference,
  candidateSetKey,
  describeInference,
  INITIAL_INFERENCE_STATE,
} from './inference-engine';
import type { SnapResult, SnapSource } from './snap-result';
import { worldPoint } from '@arq/geometry-2d';

function snap(
  source: SnapSource,
  priority: number,
  screenDistance: number,
  x = 0,
  y = 0,
): SnapResult {
  return { source, priority, screenDistance, point: worldPoint(x, y) };
}

describe('rankCandidates', () => {
  it('ranks by priority first', () => {
    const ranked = rankCandidates([snap('grid', 5, 1), snap('endpoint', 0, 9)]);

    expect(ranked.map((c) => c.source)).toEqual(['endpoint', 'grid']);
    expect(ranked[0]?.rank).toBe(0);
  });

  it('breaks equal priority by screen distance', () => {
    const ranked = rankCandidates([snap('endpoint', 0, 9, 1, 1), snap('endpoint', 0, 2, 2, 2)]);

    expect(ranked[0]?.screenDistance).toBe(2);
  });

  /**
   * Without a terminal tiebreak, two candidates equal on priority and distance
   * order by whatever the sort happens to do. On screen that is a snap
   * flickering between two points while the cursor is still.
   */
  it('produces a total order even when priority and distance both tie', () => {
    const results = [snap('midpoint', 2, 5, 0, 0), snap('centre', 2, 5, 0, 0)];

    const forward = rankCandidates(results).map((c) => c.source);
    const reversed = rankCandidates([...results].reverse()).map((c) => c.source);

    expect(forward).toEqual(reversed);
  });

  it('is stable across repeated calls with the same input', () => {
    const results = [
      snap('endpoint', 0, 3, 5, 5),
      snap('intersection', 1, 3, 5, 5),
      snap('grid', 5, 3, 5, 5),
    ];
    const first = JSON.stringify(rankCandidates(results));

    for (let i = 0; i < 10; i += 1) {
      expect(JSON.stringify(rankCandidates(results))).toBe(first);
    }
  });

  it('removes suppressed sources before ranking, so ranks stay contiguous', () => {
    const ranked = rankCandidates(
      [snap('endpoint', 0, 1), snap('grid', 5, 1), snap('midpoint', 2, 1)],
      ['grid'],
    );

    expect(ranked.map((c) => c.source)).toEqual(['endpoint', 'midpoint']);
    expect(ranked.map((c) => c.rank)).toEqual([0, 1]);
  });
});

describe('resolveInference', () => {
  it('returns no active candidate when nothing is near', () => {
    const resolution = resolveInference([]);

    expect(resolution.active).toBeUndefined();
    expect(resolution.candidates).toEqual([]);
  });

  it('activates the highest-ranked candidate by default', () => {
    const resolution = resolveInference([snap('grid', 5, 1), snap('endpoint', 0, 4)]);

    expect(resolution.active?.source).toBe('endpoint');
  });

  /**
   * Keying on the offered set rather than on distance: distance changes on
   * every mouse move, and keying on it would reset the user's Tab selection
   * continuously.
   */
  it('keeps the cycle position while the offered set is unchanged', () => {
    const results = [snap('endpoint', 0, 4, 1, 1), snap('midpoint', 2, 6, 2, 2)];
    const first = resolveInference(results);
    const cycled = cycleInference(first.state, first.candidates.length);

    // Same points, different distances - the cursor moved slightly.
    const moved = [snap('endpoint', 0, 5, 1, 1), snap('midpoint', 2, 7, 2, 2)];
    const second = resolveInference(moved, cycled);

    expect(second.active?.source).toBe('midpoint');
    expect(second.state.cycleIndex).toBe(1);
  });

  /** Otherwise the user is left cycled to rank 3 of a list that now has one entry. */
  it('resets the cycle position when the offered set changes', () => {
    const first = resolveInference([snap('endpoint', 0, 4, 1, 1), snap('midpoint', 2, 6, 2, 2)]);
    const cycled = cycleInference(first.state, first.candidates.length);

    const second = resolveInference([snap('endpoint', 0, 4, 9, 9)], cycled);

    expect(second.state.cycleIndex).toBe(0);
    expect(second.active?.source).toBe('endpoint');
  });
});

describe('cycleInference', () => {
  it('advances to the next candidate', () => {
    const resolution = resolveInference([snap('endpoint', 0, 1), snap('midpoint', 2, 1, 1, 1)]);
    const next = cycleInference(resolution.state, resolution.candidates.length);

    expect(
      resolveInference([snap('endpoint', 0, 1), snap('midpoint', 2, 1, 1, 1)], next).active?.source,
    ).toBe('midpoint');
  });

  /** Repeated presses must return to the default rather than sticking at the end. */
  it('wraps back to the first candidate', () => {
    let state = INITIAL_INFERENCE_STATE;
    state = cycleInference(state, 2);
    state = cycleInference(state, 2);

    expect(state.cycleIndex).toBe(0);
  });

  it('cycles backwards', () => {
    const state = cycleInference(INITIAL_INFERENCE_STATE, 3, -1);

    expect(state.cycleIndex).toBe(2);
  });

  it('does nothing when there is nothing to cycle through', () => {
    expect(cycleInference(INITIAL_INFERENCE_STATE, 0)).toEqual(INITIAL_INFERENCE_STATE);
  });
});

describe('suppression', () => {
  it('removes a suppressed source from the candidates', () => {
    const state = suppressSource(INITIAL_INFERENCE_STATE, 'grid');
    const resolution = resolveInference([snap('grid', 5, 1), snap('endpoint', 0, 8)], state);

    expect(resolution.candidates.map((c) => c.source)).toEqual(['endpoint']);
  });

  /** The cycled position referred to a list that no longer exists. */
  it('resets the cycle position when a source is suppressed', () => {
    const cycled = { ...INITIAL_INFERENCE_STATE, cycleIndex: 2, setKey: 'stale' };
    const state = suppressSource(cycled, 'grid');

    expect(state.cycleIndex).toBe(0);
    expect(state.setKey).toBe('');
  });

  it('suppresses a source only once', () => {
    const once = suppressSource(INITIAL_INFERENCE_STATE, 'grid');
    const twice = suppressSource(once, 'grid');

    expect(twice.suppressed).toEqual(['grid']);
    expect(twice).toBe(once);
  });

  it('keeps the suppression list sorted, so state compares equal regardless of order', () => {
    const a = suppressSource(suppressSource(INITIAL_INFERENCE_STATE, 'nearest'), 'grid');
    const b = suppressSource(suppressSource(INITIAL_INFERENCE_STATE, 'grid'), 'nearest');

    expect(a.suppressed).toEqual(b.suppressed);
  });

  it('restores a source', () => {
    const suppressed = suppressSource(INITIAL_INFERENCE_STATE, 'grid');
    const restored = unsuppressSource(suppressed, 'grid');

    expect(restored.suppressed).toEqual([]);
  });

  it('keeps suppressions through a clear, since they are a deliberate setting', () => {
    const state = suppressSource({ ...INITIAL_INFERENCE_STATE, cycleIndex: 3 }, 'grid');
    const cleared = clearInference(state);

    expect(cleared.cycleIndex).toBe(0);
    expect(cleared.suppressed).toEqual(['grid']);
  });
});

describe('candidateSetKey', () => {
  it('is unchanged when only distances move', () => {
    const a = candidateSetKey(rankCandidates([snap('endpoint', 0, 3, 1, 1)]));
    const b = candidateSetKey(rankCandidates([snap('endpoint', 0, 9, 1, 1)]));

    expect(a).toBe(b);
  });

  it('changes when a different point is offered', () => {
    const a = candidateSetKey(rankCandidates([snap('endpoint', 0, 3, 1, 1)]));
    const b = candidateSetKey(rankCandidates([snap('endpoint', 0, 3, 2, 2)]));

    expect(a).not.toBe(b);
  });
});

describe('describeInference', () => {
  /**
   * A coloured dot is invisible to a screen reader, and the cycle position has
   * to be spoken or Tab appears to do nothing.
   */
  it('names the snap source', () => {
    expect(describeInference(resolveInference([snap('endpoint', 0, 1)]))).toBe('Endpoint');
  });

  it('says where the user is in the cycle when there is more than one candidate', () => {
    const resolution = resolveInference([snap('endpoint', 0, 1), snap('midpoint', 2, 1, 1, 1)]);

    expect(describeInference(resolution)).toBe('Endpoint (1 of 2)');
  });

  it('does not clutter a single candidate with a position', () => {
    expect(describeInference(resolveInference([snap('grid', 5, 1)]))).toBe('Grid');
  });

  it('names a suggested constraint', () => {
    const resolution = resolveInference([
      { ...snap('extension', 6, 1), suggestedConstraint: { type: 'horizontal' } },
    ]);

    expect(describeInference(resolution)).toBe('Extension, horizontal');
  });

  it('says so when nothing is snapped', () => {
    expect(describeInference(resolveInference([]))).toBe('No snap');
  });
});
