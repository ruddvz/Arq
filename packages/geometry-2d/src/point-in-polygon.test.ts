import { describe, expect, it } from 'vitest';
import { worldPoint } from './coordinate-system';
import { pointInPolygon } from './point-in-polygon';

const square = [worldPoint(0, 0), worldPoint(10, 0), worldPoint(10, 10), worldPoint(0, 10)];

describe('pointInPolygon', () => {
  it('is true for a point in the interior', () => {
    expect(pointInPolygon(square, worldPoint(5, 5), 1e-9)).toBe(true);
  });

  it('is false for a point clearly outside', () => {
    expect(pointInPolygon(square, worldPoint(50, 50), 1e-9)).toBe(false);
  });

  it('is true for a point exactly on an edge (boundary counts as inside)', () => {
    expect(pointInPolygon(square, worldPoint(5, 0), 1e-9)).toBe(true);
  });

  it('is true for a point exactly on a vertex', () => {
    expect(pointInPolygon(square, worldPoint(0, 0), 1e-9)).toBe(true);
  });

  it('is false for a point just outside within a tight tolerance', () => {
    expect(pointInPolygon(square, worldPoint(-0.1, 5), 1e-9)).toBe(false);
  });

  it('is true for a point just outside when the tolerance covers it (near-boundary adversarial case)', () => {
    expect(pointInPolygon(square, worldPoint(-0.0000001, 5), 1e-6)).toBe(true);
  });

  it('returns false for fewer than 3 points (degenerate polygon)', () => {
    expect(pointInPolygon([worldPoint(0, 0), worldPoint(1, 1)], worldPoint(0, 0), 1e-9)).toBe(
      false,
    );
  });

  it('returns false for a negative tolerance', () => {
    expect(pointInPolygon(square, worldPoint(5, 5), -1e-9)).toBe(false);
  });

  it('works for a concave (L-shaped) polygon', () => {
    const lShape = [
      worldPoint(0, 0),
      worldPoint(10, 0),
      worldPoint(10, 5),
      worldPoint(5, 5),
      worldPoint(5, 10),
      worldPoint(0, 10),
    ];
    expect(pointInPolygon(lShape, worldPoint(8, 8), 1e-9)).toBe(false);
    expect(pointInPolygon(lShape, worldPoint(2, 8), 1e-9)).toBe(true);
    expect(pointInPolygon(lShape, worldPoint(8, 2), 1e-9)).toBe(true);
  });

  it('handles large world coordinates without losing precision (adversarial: large world coordinates)', () => {
    const offset = 1_000_000;
    const bigSquare = [
      worldPoint(offset, offset),
      worldPoint(offset + 10, offset),
      worldPoint(offset + 10, offset + 10),
      worldPoint(offset, offset + 10),
    ];
    expect(pointInPolygon(bigSquare, worldPoint(offset + 5, offset + 5), 1e-6)).toBe(true);
  });
});
