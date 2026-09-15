/**
 * ARQ-150 room rebuild compute microbenchmark.
 *
 * This measures traceRoomBoundary + polygonArea for one invalidated room. It is
 * deliberately not presented as the end-to-end room-settle workflow. #402 owns
 * the compute target and the later workflow measurement contract.
 */

import { readFileSync } from 'node:fs';
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

function canonicalRoomComputeTargetMs(): number {
  const authority = JSON.parse(
    readFileSync(new URL('../../../benchmarks/PERFORMANCE-BUDGETS.json', import.meta.url), 'utf8'),
  ) as {
    workflows: Array<{
      id: string;
      budget?: { metric?: string; value?: number } | null;
    }>;
  };
  const workflow = authority.workflows.find((entry) => entry.id === 'room.recompute');
  const budget = workflow?.budget;
  if (budget?.metric !== 'legacyComputeMedianMs' || typeof budget.value !== 'number') {
    throw new Error('canonical #402 room compute target is absent');
  }
  return budget.value;
}

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
  it('produces the expected deterministic grid wall count', () => {
    expect(buildGridWalls()).toHaveLength((COLS + 1) * ROWS + (ROWS + 1) * COLS);
  });

  it('correctly traces one room boundary and computes its area', () => {
    const walls = buildGridWalls();
    const traced = traceRoomBoundary(walls, cellSeedPoint(5, 3), TOLERANCE_MM);
    expect(traced.status).toBe('valid');
    expect(traced.boundary).toHaveLength(4);
    const areaMm2 = Math.abs(polygonArea(traced.boundary));
    expect(areaMm2).toBeCloseTo(CELL_WIDTH_MM * CELL_HEIGHT_MM, 0);
  });

  it('meets the canonical #402 room compute target for one invalidated room', () => {
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
    const targetMs = canonicalRoomComputeTargetMs();

    console.log(
      `room rebuild compute benchmark: median ${medianMs.toFixed(4)}ms over ${TRIAL_COUNT} trials (${walls.length}-wall grid, one room retraced); #402 target ${targetMs}ms`,
    );
    expect(medianMs).toBeLessThan(targetMs);
  });

  it('traces every room in the grid correctly', () => {
    const walls = buildGridWalls();
    let validCount = 0;
    for (let row = 0; row < ROWS; row += 1) {
      for (let col = 0; col < COLS; col += 1) {
        const traced = traceRoomBoundary(walls, cellSeedPoint(col, row), TOLERANCE_MM);
        if (traced.status === 'valid') validCount += 1;
      }
    }
    expect(validCount).toBe(COLS * ROWS);
  });
});
