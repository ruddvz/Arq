/**
 * ARQ-150: add room rebuild benchmark.
 *
 * Blueprint section 120's "room recalculation median under 150 ms for
 * one wall move" target, measured against the real room-boundary
 * pipeline: traceRoomBoundary (room-boundary-graph.ts, ARQ-111) plus
 * polygonArea (polygon-area.ts, ARQ-085) - the same two functions
 * room-placement-tool.ts (@arq/editor-shell, ARQ-112) already calls in
 * production, not a reimplementation.
 *
 * Like ARQ-149's selection benchmark, this needs no browser: boundary
 * tracing and area calculation are pure computation, so this runs as a
 * normal Vitest test using real performance.now() measurements.
 *
 * The scene is a full wall-centreline grid - 10 columns x 6 rows of
 * 4m x 3m cells, matching benchmarks/PERFORMANCE-BUDGETS.json's
 * benchmarkModel room count (60) - built from *unit* segments (one
 * per grid cell edge, sharing exact endpoints at every intersection),
 * since traceRoomBoundary's half-edge graph (room-boundary-graph.ts's
 * own doc comment) only merges vertices that already coincide within
 * tolerance; it does not split a long edge at points where other edges
 * cross it. This yields 136 wall segments (11 columns x 6 rows of
 * vertical unit segments, 7 rows x 10 columns of horizontal ones) -
 * close to, though not forced to exactly match, the benchmark model's
 * 150, since artificially padding to exactly 150 would mean adding
 * segments that do not participate in any real room boundary, which
 * would not make the benchmark any more faithful.
 *
 * "One wall move" is simulated by re-tracing a single room's boundary
 * from the *already-built* grid (a wall move would invalidate exactly
 * one room's boundary per section 36's "derived dependency graph", not
 * the whole project) - this benchmark deliberately measures one
 * targeted room recalculation, not all 60 rooms at once.
 */

import { describe, expect, it } from 'vitest';
import { polygonArea } from './polygon-area';
import { traceRoomBoundary, type RoomBoundaryEdge } from './room-boundary-graph';
import { worldPoint } from './coordinate-system';

const COLS = 10;
const ROWS = 6;
const CELL_WIDTH_MM = 4000;
const CELL_HEIGHT_MM = 3000;
const TOLERANCE_MM = 1;
const TRIAL_COUNT = 200;
const ROOM_RECALC_TARGET_MS = 150; // benchmarks/PERFORMANCE-BUDGETS.json's roomRecalculateMedianMs.

function median(values: readonly number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const lower = sorted[mid - 1];
  const upper = sorted[mid];
  if (sorted.length % 2 === 0 && lower !== undefined && upper !== undefined) {
    return (lower + upper) / 2;
  }
  return sorted[mid] ?? 0;
}

function buildGridWalls(): readonly RoomBoundaryEdge<string>[] {
  const edges: RoomBoundaryEdge<string>[] = [];
  for (let c = 0; c <= COLS; c += 1) {
    for (let r = 0; r < ROWS; r += 1) {
      edges.push({
        id: `wall-v-${c}-${r}`,
        start: worldPoint(c * CELL_WIDTH_MM, r * CELL_HEIGHT_MM),
        end: worldPoint(c * CELL_WIDTH_MM, (r + 1) * CELL_HEIGHT_MM),
      });
    }
  }
  for (let r = 0; r <= ROWS; r += 1) {
    for (let c = 0; c < COLS; c += 1) {
      edges.push({
        id: `wall-h-${c}-${r}`,
        start: worldPoint(c * CELL_WIDTH_MM, r * CELL_HEIGHT_MM),
        end: worldPoint((c + 1) * CELL_WIDTH_MM, r * CELL_HEIGHT_MM),
      });
    }
  }
  return edges;
}

function cellSeedPoint(col: number, row: number): ReturnType<typeof worldPoint> {
  return worldPoint(
    col * CELL_WIDTH_MM + CELL_WIDTH_MM / 2,
    row * CELL_HEIGHT_MM + CELL_HEIGHT_MM / 2,
  );
}

describe('room rebuild benchmark (ARQ-150)', () => {
  it('produces the expected grid wall count', () => {
    expect(buildGridWalls()).toHaveLength((COLS + 1) * ROWS + (ROWS + 1) * COLS);
  });

  it('correctly traces one room boundary and computes its area, as a correctness baseline', () => {
    const walls = buildGridWalls();
    const traced = traceRoomBoundary(walls, cellSeedPoint(5, 3), TOLERANCE_MM);
    expect(traced.status).toBe('valid');
    expect(traced.boundary).toHaveLength(4);
    const areaMm2 = Math.abs(polygonArea(traced.boundary));
    expect(areaMm2).toBeCloseTo(CELL_WIDTH_MM * CELL_HEIGHT_MM, 0);
  });

  it('meets the room recalculation median under 150ms target (section 120) for one wall move', () => {
    const walls = buildGridWalls();
    const seedPoint = cellSeedPoint(5, 3);
    const durationsMs: number[] = [];

    for (let trial = 0; trial < TRIAL_COUNT; trial += 1) {
      const start = performance.now();
      const traced = traceRoomBoundary(walls, seedPoint, TOLERANCE_MM);
      polygonArea(traced.boundary);
      durationsMs.push(performance.now() - start);
    }

    const medianMs = median(durationsMs);
    // eslint-disable-next-line no-console
    console.log(
      `room rebuild benchmark: median ${medianMs.toFixed(4)}ms over ${TRIAL_COUNT} trials (${walls.length}-wall grid, one room retraced)`,
    );
    expect(medianMs).toBeLessThan(ROOM_RECALC_TARGET_MS);
  });

  it('traces every room in the grid correctly (broader correctness check than the single-room benchmark)', () => {
    const walls = buildGridWalls();
    let validCount = 0;
    for (let row = 0; row < ROWS; row += 1) {
      for (let col = 0; col < COLS; col += 1) {
        const traced = traceRoomBoundary(walls, cellSeedPoint(col, row), TOLERANCE_MM);
        if (traced.status === 'valid') {
          validCount += 1;
        }
      }
    }
    expect(validCount).toBe(COLS * ROWS);
  });
});
