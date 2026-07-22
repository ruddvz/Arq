import { describe, expect, it } from 'vitest';
import { worldPoint } from './coordinate-system';
import { segmentIntersection } from './segment-intersection';

describe('segmentIntersection', () => {
  it('finds the crossing point of two perpendicular segments', () => {
    const a = { start: worldPoint(0, 0), end: worldPoint(10, 0) };
    const b = { start: worldPoint(5, -5), end: worldPoint(5, 5) };
    const result = segmentIntersection(a, b, 1e-9);
    expect(result?.x).toBeCloseTo(5, 9);
    expect(result?.y).toBeCloseTo(0, 9);
  });

  it('gives the same result regardless of which endpoint is labelled start (adversarial: reversed segment order)', () => {
    const a = { start: worldPoint(0, 0), end: worldPoint(10, 0) };
    const b = { start: worldPoint(5, -5), end: worldPoint(5, 5) };
    const reversedA = { start: a.end, end: a.start };
    const reversedB = { start: b.end, end: b.start };
    const forward = segmentIntersection(a, b, 1e-9);
    const reversed = segmentIntersection(reversedA, reversedB, 1e-9);
    expect(reversed?.x).toBeCloseTo(forward!.x, 9);
    expect(reversed?.y).toBeCloseTo(forward!.y, 9);
  });

  it('returns null for exactly parallel segments', () => {
    const a = { start: worldPoint(0, 0), end: worldPoint(10, 0) };
    const b = { start: worldPoint(0, 5), end: worldPoint(10, 5) };
    expect(segmentIntersection(a, b, 1e-9)).toBeNull();
  });

  it('returns null for a zero-length segment (adversarial: zero-length segments)', () => {
    const a = { start: worldPoint(5, 5), end: worldPoint(5, 5) };
    const b = { start: worldPoint(0, 0), end: worldPoint(10, 10) };
    expect(segmentIntersection(a, b, 1e-9)).toBeNull();
  });

  it('returns null when the crossing point falls outside either segment', () => {
    const a = { start: worldPoint(0, 0), end: worldPoint(1, 0) };
    const b = { start: worldPoint(5, -5), end: worldPoint(5, 5) };
    expect(segmentIntersection(a, b, 1e-9)).toBeNull();
  });

  it('detects an intersection exactly at a shared endpoint (boundary-inclusive)', () => {
    const a = { start: worldPoint(0, 0), end: worldPoint(10, 0) };
    const b = { start: worldPoint(10, 0), end: worldPoint(10, 10) };
    const result = segmentIntersection(a, b, 1e-9);
    expect(result?.x).toBeCloseTo(10, 9);
    expect(result?.y).toBeCloseTo(0, 9);
  });

  it('treats a tiny-angle crossing as non-parallel when the angle exceeds the tolerance (adversarial: wall crossing at tiny angles)', () => {
    // segment B crosses A at a very shallow angle (~0.001 radians).
    const a = { start: worldPoint(0, 0), end: worldPoint(100, 0) };
    const b = { start: worldPoint(50, -5), end: worldPoint(50.005, 5) };
    expect(segmentIntersection(a, b, 1e-6)).not.toBeNull();
  });

  it('treats a near-parallel crossing as parallel once its angle is within tolerance', () => {
    const a = { start: worldPoint(0, 0), end: worldPoint(100, 0) };
    // b's direction differs from a's by an extremely small angle.
    const b = { start: worldPoint(0, 1), end: worldPoint(100, 1 + 1e-10) };
    expect(segmentIntersection(a, b, 1e-6)).toBeNull();
  });

  it('handles large world coordinates without losing precision (adversarial: large world coordinates)', () => {
    const a = { start: worldPoint(1_000_000, 0), end: worldPoint(1_000_010, 0) };
    const b = { start: worldPoint(1_000_005, -5), end: worldPoint(1_000_005, 5) };
    const result = segmentIntersection(a, b, 1e-9);
    expect(result?.x).toBeCloseTo(1_000_005, 6);
    expect(result?.y).toBeCloseTo(0, 6);
  });

  it('handles coordinates near zero without a sign or precision error (adversarial: values near zero)', () => {
    const a = { start: worldPoint(-1e-8, 0), end: worldPoint(1e-8, 0) };
    const b = { start: worldPoint(0, -1e-8), end: worldPoint(0, 1e-8) };
    const result = segmentIntersection(a, b, 1e-9);
    expect(result?.x).toBeCloseTo(0, 12);
    expect(result?.y).toBeCloseTo(0, 12);
  });

  it('returns null for a non-finite endpoint rather than propagating NaN (adversarial: non-finite values)', () => {
    const a = { start: worldPoint(NaN, 0), end: worldPoint(10, 0) };
    const b = { start: worldPoint(5, -5), end: worldPoint(5, 5) };
    expect(segmentIntersection(a, b, 1e-9)).toBeNull();
  });

  it('returns null for an invalid tolerance', () => {
    const a = { start: worldPoint(0, 0), end: worldPoint(10, 0) };
    const b = { start: worldPoint(5, -5), end: worldPoint(5, 5) };
    expect(segmentIntersection(a, b, -1)).toBeNull();
    expect(segmentIntersection(a, b, NaN)).toBeNull();
  });
});
