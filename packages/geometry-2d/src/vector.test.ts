import { describe, expect, it } from 'vitest';
import { worldPoint } from './coordinate-system';
import {
  addVectors,
  crossProduct,
  dotProduct,
  normalizeVector,
  scaleVector,
  subtractVectors,
  translatePoint,
  vector2,
  vectorBetween,
  vectorLength,
} from './vector';

describe('addVectors / subtractVectors / scaleVector', () => {
  it('add and subtract component-wise', () => {
    expect(addVectors(vector2(1, 2), vector2(3, 4))).toEqual(vector2(4, 6));
    expect(subtractVectors(vector2(4, 6), vector2(1, 2))).toEqual(vector2(3, 4));
  });

  it('scales both components by the scalar', () => {
    expect(scaleVector(vector2(2, 3), 2)).toEqual(vector2(4, 6));
  });
});

describe('dotProduct / crossProduct', () => {
  it('dot product of perpendicular vectors is zero', () => {
    expect(dotProduct(vector2(1, 0), vector2(0, 1))).toBe(0);
  });

  it('cross product is positive when b is counter-clockwise from a', () => {
    expect(crossProduct(vector2(1, 0), vector2(0, 1))).toBeGreaterThan(0);
    expect(crossProduct(vector2(0, 1), vector2(1, 0))).toBeLessThan(0);
  });

  it('cross product of parallel vectors is zero (adversarial: reversed segment order still parallel)', () => {
    expect(crossProduct(vector2(2, 0), vector2(-3, 0))).toBe(0);
  });
});

describe('vectorLength', () => {
  it('computes the Euclidean length', () => {
    expect(vectorLength(vector2(3, 4))).toBe(5);
  });

  it('is zero for a zero vector', () => {
    expect(vectorLength(vector2(0, 0))).toBe(0);
  });
});

describe('normalizeVector', () => {
  it('returns a unit vector in the same direction', () => {
    const normalized = normalizeVector(vector2(3, 4));
    expect(normalized?.x).toBeCloseTo(0.6, 10);
    expect(normalized?.y).toBeCloseTo(0.8, 10);
    expect(vectorLength(normalized!)).toBeCloseTo(1, 10);
  });

  it('returns null for a zero-length vector rather than NaN (adversarial: zero-length segments)', () => {
    expect(normalizeVector(vector2(0, 0))).toBeNull();
  });

  it('returns null for a non-finite vector (adversarial: non-finite values)', () => {
    expect(normalizeVector(vector2(Infinity, 0))).toBeNull();
    expect(normalizeVector(vector2(NaN, 0))).toBeNull();
  });
});

describe('vectorBetween / translatePoint', () => {
  it('round-trips: translating a point by the vector between it and another point lands on that point', () => {
    const a = worldPoint(1, 2);
    const b = worldPoint(5, -3);
    const delta = vectorBetween(a, b);
    const result = translatePoint(a, delta);
    expect(result.x).toBeCloseTo(b.x, 10);
    expect(result.y).toBeCloseTo(b.y, 10);
  });

  it('is the zero vector for coincident points (adversarial: nearly/exactly coincident endpoints)', () => {
    const a = worldPoint(5, 5);
    expect(vectorBetween(a, a)).toEqual(vector2(0, 0));
  });

  it('handles large world coordinates without precision collapse (adversarial: large world coordinates)', () => {
    const a = worldPoint(1_000_000, 1_000_000);
    const b = worldPoint(1_000_010, 1_000_000);
    expect(vectorBetween(a, b)).toEqual(vector2(10, 0));
  });
});
