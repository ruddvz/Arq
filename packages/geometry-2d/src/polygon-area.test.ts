import { describe, expect, it } from 'vitest';
import { worldPoint } from './coordinate-system';
import { polygonArea, signedArea, windingOf } from './polygon-area';

const unitSquareCcw = [worldPoint(0, 0), worldPoint(1, 0), worldPoint(1, 1), worldPoint(0, 1)];
const unitSquareCw = [worldPoint(0, 0), worldPoint(0, 1), worldPoint(1, 1), worldPoint(1, 0)];

describe('signedArea', () => {
  it('is positive for a counter-clockwise square', () => {
    expect(signedArea(unitSquareCcw)).toBeCloseTo(1, 10);
  });

  it('is negative for the same square traversed clockwise', () => {
    expect(signedArea(unitSquareCw)).toBeCloseTo(-1, 10);
  });

  it('is zero for fewer than 3 points (adversarial: degenerate polygon)', () => {
    expect(signedArea([])).toBe(0);
    expect(signedArea([worldPoint(0, 0)])).toBe(0);
    expect(signedArea([worldPoint(0, 0), worldPoint(1, 1)])).toBe(0);
  });

  it('is zero for a polygon whose points are all coincident (adversarial: nearly/exactly coincident points)', () => {
    const points = [worldPoint(5, 5), worldPoint(5, 5), worldPoint(5, 5)];
    expect(signedArea(points)).toBe(0);
  });

  it('is zero for collinear points (a degenerate "polygon" with no enclosed area)', () => {
    const points = [worldPoint(0, 0), worldPoint(1, 0), worldPoint(2, 0)];
    expect(signedArea(points)).toBe(0);
  });

  it('handles large world coordinates without losing precision (adversarial: large world coordinates)', () => {
    const offset = 1_000_000;
    const square = unitSquareCcw.map((p) => worldPoint(p.x + offset, p.y + offset));
    expect(signedArea(square)).toBeCloseTo(1, 6);
  });

  it('scales quadratically with a linear scale-up (sanity check on the formula)', () => {
    const bigSquare = [worldPoint(0, 0), worldPoint(10, 0), worldPoint(10, 10), worldPoint(0, 10)];
    expect(signedArea(bigSquare)).toBeCloseTo(100, 8);
  });
});

describe('polygonArea', () => {
  it('is always non-negative regardless of winding direction', () => {
    expect(polygonArea(unitSquareCcw)).toBeCloseTo(1, 10);
    expect(polygonArea(unitSquareCw)).toBeCloseTo(1, 10);
  });
});

describe('windingOf', () => {
  it('reports counter-clockwise for a positively-signed polygon', () => {
    expect(windingOf(unitSquareCcw, 1e-9)).toBe('counter-clockwise');
  });

  it('reports clockwise for a negatively-signed polygon', () => {
    expect(windingOf(unitSquareCw, 1e-9)).toBe('clockwise');
  });

  it('reports degenerate for a polygon with fewer than 3 points', () => {
    expect(windingOf([worldPoint(0, 0), worldPoint(1, 1)], 1e-9)).toBe('degenerate');
  });

  it('reports degenerate for collinear points (adversarial: near-degenerate case)', () => {
    expect(windingOf([worldPoint(0, 0), worldPoint(1, 0), worldPoint(2, 0)], 1e-9)).toBe(
      'degenerate',
    );
  });

  it('reports degenerate for a signed area within tolerance of zero, even if not exactly zero', () => {
    // a very thin sliver of a "square" - tiny but non-zero signed area.
    const sliver = [worldPoint(0, 0), worldPoint(1, 0), worldPoint(1, 1e-10), worldPoint(0, 1e-10)];
    expect(windingOf(sliver, 1e-6)).toBe('degenerate');
  });

  it('rejects an invalid tolerance as degenerate rather than guessing', () => {
    expect(windingOf(unitSquareCcw, -1)).toBe('degenerate');
    expect(windingOf(unitSquareCcw, NaN)).toBe('degenerate');
  });
});
