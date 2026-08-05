import { describe, expect, it } from 'vitest';
import { worldPoint } from '@arq/geometry-2d';
import type { Viewport } from '@arq/geometry-2d';
import { collectSnapCandidates } from './snap-candidate-collection';
import { resolveInference, INITIAL_INFERENCE_STATE } from './inference-engine';
import { SNAP_SOURCE_PRIORITY, type SnapSource } from './snap-result';

/**
 * V3-090. Until `collectSnapCandidates` existed, the eight snap modules and the
 * ranking layer had no path between them: the ranker took a list nothing built.
 */

const VIEWPORT: Viewport = {
  center: worldPoint(0, 0),
  pixelsPerUnit: 1,
  screenWidth: 800,
  screenHeight: 600,
};

/**
 * A scene arranged so that every source has something to find at the origin: two
 * segments crossing there, their endpoints on it, a circle centred on it, and a
 * grid line through it.
 *
 * The third segment is the one that is easy to leave out. Extension snaps only
 * to a point *beyond* a segment's endpoints - a point between them is what
 * endpoint, midpoint and nearest are for - so a scene where every segment
 * contains the cursor produces no extension candidate at all. `(200,0)-(300,0)`
 * is collinear with the horizontal segment and stops short of the origin, so the
 * origin lies on its extended line and outside its bounds.
 */
const CROSSROADS = {
  endpoints: [{ point: worldPoint(0, 0) }],
  segments: [
    { start: worldPoint(-100, 0), end: worldPoint(100, 0) },
    { start: worldPoint(0, -100), end: worldPoint(0, 100) },
    { start: worldPoint(200, 0), end: worldPoint(300, 0) },
  ],
  circulars: [{ kind: 'circle' as const, centre: worldPoint(0, 0), radius: 50 }],
  gridSpacing: 100,
  from: worldPoint(0, -100),
};

describe('collectSnapCandidates', () => {
  it('reaches every declared snap source', () => {
    const results = collectSnapCandidates(CROSSROADS, worldPoint(0, 0), VIEWPORT);
    const sources = new Set(results.map((result) => result.source));

    // Every source in the canonical priority table is reachable through this
    // one call. A source that no arrangement of a scene can produce is a source
    // the drawing tools can never offer, however well tested it is on its own.
    for (const source of Object.keys(SNAP_SOURCE_PRIORITY) as SnapSource[]) {
      expect(sources.has(source), `no candidate from source "${source}"`).toBe(true);
    }
  });

  it('returns candidates in canonical source-priority order', () => {
    const results = collectSnapCandidates(CROSSROADS, worldPoint(0, 0), VIEWPORT);
    const priorities = results.map((result) => SNAP_SOURCE_PRIORITY[result.source]);

    expect(priorities).toEqual([...priorities].sort((a, b) => a - b));
  });

  it('is deterministic: the same scene and cursor give the same order every time', () => {
    // The flicker this prevents is visible, not theoretical - a candidate list
    // that reorders between frames while the cursor is still reads as the
    // application being broken.
    const once = collectSnapCandidates(CROSSROADS, worldPoint(1, 1), VIEWPORT);
    const twice = collectSnapCandidates(CROSSROADS, worldPoint(1, 1), VIEWPORT);

    expect(twice).toEqual(once);
  });

  it('finds nothing in an empty scene rather than throwing', () => {
    expect(collectSnapCandidates({}, worldPoint(0, 0), VIEWPORT)).toEqual([]);
  });

  describe('an absent source is not an empty one', () => {
    it('skips perpendicular when there is no point to measure from', () => {
      const { from: _from, ...withoutFrom } = CROSSROADS;
      const results = collectSnapCandidates(withoutFrom, worldPoint(0, 0), VIEWPORT);

      expect(results.some((result) => result.source === 'perpendicular')).toBe(false);
      // The other segment-fed sources still run - dropping `from` must not
      // silently disable the segments it shares.
      expect(results.some((result) => result.source === 'intersection')).toBe(true);
    });

    it('skips the grid when no spacing is given', () => {
      const { gridSpacing: _spacing, ...withoutGrid } = CROSSROADS;
      const results = collectSnapCandidates(withoutGrid, worldPoint(0, 0), VIEWPORT);

      expect(results.some((result) => result.source === 'grid')).toBe(false);
    });

    it('runs a source against empty geometry when given an empty array', () => {
      // Distinct from omitting the key: the source ran and found nothing. Both
      // produce no candidates, and only one of them means "this source is off".
      expect(collectSnapCandidates({ segments: [] }, worldPoint(0, 0), VIEWPORT)).toEqual([]);
    });
  });

  it('feeds the ranking layer it was written for', () => {
    const results = collectSnapCandidates(CROSSROADS, worldPoint(0, 0), VIEWPORT);
    const inference = resolveInference(results, INITIAL_INFERENCE_STATE);

    expect(inference.candidates.length).toBe(results.length);
    // Endpoint is priority 0, so it wins outright when everything coincides.
    expect(inference.active?.source).toBe('endpoint');
  });

  it('honours suppression through the ranker without re-running the geometry', () => {
    const results = collectSnapCandidates(CROSSROADS, worldPoint(0, 0), VIEWPORT);
    const inference = resolveInference(results, {
      ...INITIAL_INFERENCE_STATE,
      suppressed: ['endpoint'],
    });

    expect(inference.candidates.some((candidate) => candidate.source === 'endpoint')).toBe(false);
    expect(inference.active?.source).toBe('intersection');
  });
});
