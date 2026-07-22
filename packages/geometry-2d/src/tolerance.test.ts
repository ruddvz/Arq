import { describe, expect, it } from 'vitest';
import {
  anglesAreWithinTolerance,
  numbersAreExactlyEqual,
  numbersAreWithinTolerance,
  pointsAreCoincident,
} from './tolerance';

describe('numbersAreExactlyEqual', () => {
  it('is true only for bit-identical values', () => {
    expect(numbersAreExactlyEqual(1, 1)).toBe(true);
    expect(numbersAreExactlyEqual(1, 1.0000001)).toBe(false);
  });
});

describe('numbersAreWithinTolerance', () => {
  it('is true when the difference is within tolerance', () => {
    expect(numbersAreWithinTolerance(1, 1.0000001, 1e-6)).toBe(true);
  });

  it('is false when the difference exceeds tolerance', () => {
    expect(numbersAreWithinTolerance(1, 1.1, 1e-6)).toBe(false);
  });

  it('rejects non-finite inputs rather than silently comparing them (adversarial: NaN/Infinity)', () => {
    expect(numbersAreWithinTolerance(NaN, 1, 1e-6)).toBe(false);
    expect(numbersAreWithinTolerance(1, Infinity, 1e-6)).toBe(false);
    expect(numbersAreWithinTolerance(1, 1, NaN)).toBe(false);
  });

  it('rejects a negative tolerance', () => {
    expect(numbersAreWithinTolerance(1, 1, -1)).toBe(false);
  });

  it('treats a zero tolerance as exact equality', () => {
    expect(numbersAreWithinTolerance(1, 1, 0)).toBe(true);
    expect(numbersAreWithinTolerance(1, 1.0000001, 0)).toBe(false);
  });
});

describe('pointsAreCoincident', () => {
  it('is true for two points closer than the tolerance', () => {
    expect(pointsAreCoincident({ x: 0, y: 0 }, { x: 0.0000001, y: 0 }, 1e-6)).toBe(true);
  });

  it('is false for two points farther apart than the tolerance (adversarial: nearly coincident endpoints)', () => {
    expect(pointsAreCoincident({ x: 0, y: 0 }, { x: 0.001, y: 0 }, 1e-6)).toBe(false);
  });

  it('handles large world coordinates without losing tolerance meaning (adversarial: large world coordinates)', () => {
    expect(
      pointsAreCoincident(
        { x: 1_000_000, y: 1_000_000 },
        { x: 1_000_000.0000001, y: 1_000_000 },
        1e-6,
      ),
    ).toBe(true);
  });

  it('is false when either point contains a non-finite coordinate (adversarial: non-finite values)', () => {
    expect(pointsAreCoincident({ x: NaN, y: 0 }, { x: 0, y: 0 }, 1)).toBe(false);
    expect(pointsAreCoincident({ x: Infinity, y: 0 }, { x: Infinity, y: 0 }, 1)).toBe(false);
  });
});

describe('anglesAreWithinTolerance', () => {
  it('is true for two angles that differ by less than tolerance', () => {
    expect(anglesAreWithinTolerance(0, 0.0000001, 1e-6)).toBe(true);
  });

  it('treats angles wrapping across -pi/pi as equal (adversarial: wall crossing at tiny angles near the wrap point)', () => {
    expect(anglesAreWithinTolerance(Math.PI, -Math.PI, 1e-9)).toBe(true);
    expect(anglesAreWithinTolerance(Math.PI - 1e-9, -Math.PI + 1e-9, 1e-6)).toBe(true);
  });

  it('is false for angles that differ by more than tolerance', () => {
    expect(anglesAreWithinTolerance(0, Math.PI / 2, 1e-6)).toBe(false);
  });
});
