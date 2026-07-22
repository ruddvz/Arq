/**
 * ARQ-090: build geometry adversarial fixtures.
 *
 * Reusable, named fixtures for the geometry bugs blueprint section 42
 * lists, so ARQ-081 through ARQ-085's regression coverage draws from one
 * shared, deliberately-named set of adversarial inputs instead of each
 * test file inventing its own ad hoc values.
 *
 * Section 42 lists 19 cases. Five are explicitly NOT modelled here,
 * documented rather than faked, because they need entity types
 * (Wall/Opening/Room) this repository does not have yet - only
 * `packages/bim-core`'s `Level`/`ElementBase`/`PropertyState` exist so
 * far, no Wall or Opening schema:
 * - opening touching wall end
 * - two openings touching
 * - room containing island (also out of scope per polygon-area.ts's own
 *   single-ring-only limitation)
 * - extremely thin wall
 * - negative dimensions
 * The other 14 are modelled below as concrete, reusable fixtures, and
 * exercised against the real primitives in
 * adversarial-fixtures.test.ts.
 */

import { worldPoint, type WorldPoint } from './coordinate-system';
import type { Segment } from './segment';

export const LARGE_WORLD_COORDINATE_OFFSET = 1_000_000;
export const VALUE_NEAR_ZERO = 1e-10;

export const ZERO_LENGTH_SEGMENT: Segment = { start: worldPoint(5, 5), end: worldPoint(5, 5) };

export const NEARLY_COINCIDENT_ENDPOINTS: readonly [WorldPoint, WorldPoint] = [
  worldPoint(0, 0),
  worldPoint(1e-10, 0),
];

export function reversedSegment(segment: Segment): Segment {
  return { start: segment.end, end: segment.start };
}

/** A T join: a long horizontal wall and a vertical wall meeting exactly at the horizontal wall's midpoint. */
export function tJoinSegments(): readonly [Segment, Segment] {
  return [
    { start: worldPoint(0, 0), end: worldPoint(10, 0) },
    { start: worldPoint(5, 0), end: worldPoint(5, 10) },
  ];
}

/** Four segments radiating from the same point, the four-way wall-join case. */
export function fourWayJoinSegments(): readonly [Segment, Segment, Segment, Segment] {
  return [
    { start: worldPoint(0, 0), end: worldPoint(10, 0) },
    { start: worldPoint(0, 0), end: worldPoint(-10, 0) },
    { start: worldPoint(0, 0), end: worldPoint(0, 10) },
    { start: worldPoint(0, 0), end: worldPoint(0, -10) },
  ];
}

/** Two collinear segments that overlap along part of their length, rather than crossing at a single point. */
export function overlappingCollinearSegments(): readonly [Segment, Segment] {
  return [
    { start: worldPoint(0, 0), end: worldPoint(10, 0) },
    { start: worldPoint(5, 0), end: worldPoint(15, 0) },
  ];
}

/** The exact same segment twice - a duplicated wall. */
export function duplicatedSegment(): readonly [Segment, Segment] {
  const a: Segment = { start: worldPoint(0, 0), end: worldPoint(10, 0) };
  return [a, { start: worldPoint(a.start.x, a.start.y), end: worldPoint(a.end.x, a.end.y) }];
}

/** A near-square "room" boundary whose last point misses closing the loop exactly by `gap`. */
export function roomWithTinyGap(gap: number): readonly WorldPoint[] {
  return [worldPoint(0, 0), worldPoint(10, 0), worldPoint(10, 10), worldPoint(gap, 10)];
}

/** A self-intersecting ("bowtie") quadrilateral - a room boundary that crosses itself. */
export function selfIntersectingPolygon(): readonly WorldPoint[] {
  return [worldPoint(0, 0), worldPoint(10, 10), worldPoint(10, 0), worldPoint(0, 10)];
}

/** A polyline with immediately-repeated points, as a naive DXF/IFC polyline import might produce. */
export function polylineWithDuplicatePoints(): readonly WorldPoint[] {
  return [
    worldPoint(0, 0),
    worldPoint(0, 0),
    worldPoint(10, 0),
    worldPoint(10, 10),
    worldPoint(10, 10),
  ];
}
