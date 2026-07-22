import { describe, expect, it } from 'vitest';
import { worldPoint } from './coordinate-system';
import { closestPointOnSegment } from './nearest-point';
import { signedArea } from './polygon-area';
import { segmentIntersection } from './segment-intersection';
import type { Segment } from './segment';
import {
  ZERO_LENGTH_SEGMENT,
  NEARLY_COINCIDENT_ENDPOINTS,
  LARGE_WORLD_COORDINATE_OFFSET,
  VALUE_NEAR_ZERO,
  duplicatedSegment,
  fourWayJoinSegments,
  overlappingCollinearSegments,
  polylineWithDuplicatePoints,
  reversedSegment,
  roomWithTinyGap,
  selfIntersectingPolygon,
  tJoinSegments,
} from './adversarial-fixtures';

describe('geometry adversarial fixtures exercised against the real primitives', () => {
  it('zero-length segment: intersection is null, closest point is the single point', () => {
    const other: Segment = { start: worldPoint(0, 0), end: worldPoint(10, 10) };
    expect(segmentIntersection(ZERO_LENGTH_SEGMENT, other, 1e-9)).toBeNull();
    expect(closestPointOnSegment(ZERO_LENGTH_SEGMENT, worldPoint(100, 100))).toEqual(
      ZERO_LENGTH_SEGMENT.start,
    );
  });

  it('nearly coincident endpoints: a segment built from them is treated as zero-length', () => {
    const [a, b] = NEARLY_COINCIDENT_ENDPOINTS;
    const tinySegment = { start: a, end: b };
    // 1e-10 apart is below any realistic tolerance, so this behaves like a
    // point, not a direction - closestPointOnSegment must not divide by
    // (effectively) zero and produce garbage.
    const result = closestPointOnSegment(tinySegment, worldPoint(50, 50));
    expect(Number.isFinite(result.x) && Number.isFinite(result.y)).toBe(true);
  });

  it('reversed segment order does not change an intersection result', () => {
    const [a, b] = tJoinSegments();
    const forward = segmentIntersection(a, b, 1e-9);
    const reversed = segmentIntersection(reversedSegment(a), reversedSegment(b), 1e-9);
    expect(reversed?.x).toBeCloseTo(forward!.x, 9);
    expect(reversed?.y).toBeCloseTo(forward!.y, 9);
  });

  it("T join: the crossing segment intersects at the long wall's midpoint", () => {
    const [wall, tee] = tJoinSegments();
    const result = segmentIntersection(wall, tee, 1e-9);
    expect(result?.x).toBeCloseTo(5, 9);
    expect(result?.y).toBeCloseTo(0, 9);
  });

  it('four-way join: perpendicular pairs cross at the shared point, collinear-opposite pairs report no single intersection', () => {
    const [east, west, north, south] = fourWayJoinSegments();
    const eastNorth = segmentIntersection(east, north, 1e-9);
    expect(eastNorth?.x).toBeCloseTo(0, 9);
    expect(eastNorth?.y).toBeCloseTo(0, 9);
    // east and west are collinear (opposite directions through the origin)
    // - segmentIntersection correctly reports null since there is no
    // single crossing point, even though they touch at the origin.
    expect(segmentIntersection(east, west, 1e-9)).toBeNull();
    expect(segmentIntersection(north, south, 1e-9)).toBeNull();
  });

  it('overlapping collinear segments: no single intersection point is reported (a documented limitation, not a crash)', () => {
    const [a, b] = overlappingCollinearSegments();
    expect(segmentIntersection(a, b, 1e-9)).toBeNull();
  });

  it('duplicated segment: intersecting a segment with an identical copy of itself is null, not a crash', () => {
    const [a, b] = duplicatedSegment();
    expect(segmentIntersection(a, b, 1e-9)).toBeNull();
  });

  it('room with a tiny closing gap: signed area is still close to the intended enclosed area', () => {
    const nearlyClosed = roomWithTinyGap(1e-6);
    // a perfect 10x10 square has area 100; a gap of 1e-6 in one corner
    // should not meaningfully change that.
    expect(Math.abs(signedArea(nearlyClosed))).toBeCloseTo(100, 4);
  });

  it('self-intersecting polygon: signed area does not represent the naive enclosed area (documented limitation)', () => {
    const bowtie = selfIntersectingPolygon();
    // a bowtie through a 10x10 bounding box is NOT area 100 - the crossing
    // cancels out most of the shoelace sum. This test exists to prove
    // polygon-area.ts's documented caveat is real, not just asserted.
    expect(Math.abs(signedArea(bowtie))).not.toBeCloseTo(100, 0);
  });

  it('imported polyline with duplicate points: signed area is unaffected by the repeated points', () => {
    const withDuplicates = polylineWithDuplicatePoints();
    const withoutDuplicates = [worldPoint(0, 0), worldPoint(10, 0), worldPoint(10, 10)];
    expect(signedArea(withDuplicates)).toBeCloseTo(signedArea(withoutDuplicates), 9);
  });

  it('large world coordinates: T join still resolves correctly when translated far from the origin', () => {
    const offset = LARGE_WORLD_COORDINATE_OFFSET;
    const [wall, tee] = tJoinSegments();
    const translate = (s: {
      start: ReturnType<typeof worldPoint>;
      end: ReturnType<typeof worldPoint>;
    }) => ({
      start: worldPoint(s.start.x + offset, s.start.y + offset),
      end: worldPoint(s.end.x + offset, s.end.y + offset),
    });
    const result = segmentIntersection(translate(wall), translate(tee), 1e-6);
    expect(result?.x).toBeCloseTo(5 + offset, 3);
    expect(result?.y).toBeCloseTo(0 + offset, 3);
  });

  it('values near zero: a T join built at microscopic scale still resolves correctly', () => {
    const scale = VALUE_NEAR_ZERO;
    const wall = { start: worldPoint(0, 0), end: worldPoint(10 * scale, 0) };
    const tee = { start: worldPoint(5 * scale, 0), end: worldPoint(5 * scale, 10 * scale) };
    const result = segmentIntersection(wall, tee, scale * 1e-3);
    expect(result?.x).toBeCloseTo(5 * scale, 15);
    expect(result?.y).toBeCloseTo(0, 15);
  });
});
