import { describe, expect, it } from 'vitest';
import { worldPoint } from './coordinate-system';
import { offsetSegment } from './offset-segment';

describe('offsetSegment', () => {
  it('moves a horizontal segment left (perpendicular) for a positive distance', () => {
    const segment = { start: worldPoint(0, 0), end: worldPoint(10, 0) };
    const result = offsetSegment(segment, 3, 1e-9)!;
    expect(result.start.x).toBeCloseTo(0, 9);
    expect(result.start.y).toBeCloseTo(3, 9);
    expect(result.end.x).toBeCloseTo(10, 9);
    expect(result.end.y).toBeCloseTo(3, 9);
  });

  it('moves a horizontal segment right for a negative distance', () => {
    const segment = { start: worldPoint(0, 0), end: worldPoint(10, 0) };
    const result = offsetSegment(segment, -3, 1e-9)!;
    expect(result.start.y).toBeCloseTo(-3, 9);
    expect(result.end.y).toBeCloseTo(-3, 9);
  });

  it('preserves the segment length and direction', () => {
    const segment = { start: worldPoint(1, 1), end: worldPoint(4, 5) };
    const result = offsetSegment(segment, 2, 1e-9)!;
    const originalLength = Math.hypot(4 - 1, 5 - 1);
    const resultLength = Math.hypot(result.end.x - result.start.x, result.end.y - result.start.y);
    expect(resultLength).toBeCloseTo(originalLength, 9);
  });

  it('returns an unchanged copy for a zero distance', () => {
    const segment = { start: worldPoint(1, 1), end: worldPoint(4, 5) };
    const result = offsetSegment(segment, 0, 1e-9)!;
    expect(result.start).toEqual(segment.start);
    expect(result.end).toEqual(segment.end);
  });

  it('returns null for a degenerate (zero-length) segment (adversarial: zero-length segments)', () => {
    const segment = { start: worldPoint(5, 5), end: worldPoint(5, 5) };
    expect(offsetSegment(segment, 3, 1e-9)).toBeNull();
  });

  it('returns null for a segment shorter than tolerance (adversarial: near-coincident endpoints)', () => {
    const segment = { start: worldPoint(0, 0), end: worldPoint(1e-12, 0) };
    expect(offsetSegment(segment, 3, 1e-9)).toBeNull();
  });

  it('returns null for a negative tolerance', () => {
    const segment = { start: worldPoint(0, 0), end: worldPoint(10, 0) };
    expect(offsetSegment(segment, 3, -1e-9)).toBeNull();
  });

  it('returns null for a non-finite distance (adversarial: non-finite values)', () => {
    const segment = { start: worldPoint(0, 0), end: worldPoint(10, 0) };
    expect(offsetSegment(segment, Number.POSITIVE_INFINITY, 1e-9)).toBeNull();
    expect(offsetSegment(segment, Number.NaN, 1e-9)).toBeNull();
  });

  it('handles large world coordinates without losing precision (adversarial: large world coordinates)', () => {
    const offset = 1_000_000;
    const segment = { start: worldPoint(offset, offset), end: worldPoint(offset + 10, offset) };
    const result = offsetSegment(segment, 5, 1e-6)!;
    expect(result.start.y).toBeCloseTo(offset + 5, 3);
    expect(result.end.y).toBeCloseTo(offset + 5, 3);
  });
});
