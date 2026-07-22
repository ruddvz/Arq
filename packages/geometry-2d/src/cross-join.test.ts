import { describe, expect, it } from 'vitest';
import { worldPoint } from './coordinate-system';
import { crossJoinPoint } from './cross-join';

describe('crossJoinPoint', () => {
  it("finds the crossing point when both walls genuinely cross through each other's interior", () => {
    const wallA = { start: worldPoint(0, 5), end: worldPoint(10, 5) };
    const wallB = { start: worldPoint(5, 0), end: worldPoint(5, 10) };
    const point = crossJoinPoint(wallA, wallB, 1e-9);
    expect(point?.x).toBeCloseTo(5, 9);
    expect(point?.y).toBeCloseTo(5, 9);
  });

  it("returns null when one wall only touches the other's interior at its own endpoint (a T, not a cross)", () => {
    const wallA = { start: worldPoint(0, 5), end: worldPoint(10, 5) };
    const wallB = { start: worldPoint(5, 5), end: worldPoint(5, 10) }; // wallB starts exactly on wallA
    expect(crossJoinPoint(wallA, wallB, 1e-9)).toBeNull();
  });

  it('returns null when the walls meet exactly at a shared endpoint (a corner, not a cross)', () => {
    const wallA = { start: worldPoint(0, 0), end: worldPoint(10, 0) };
    const wallB = { start: worldPoint(0, 0), end: worldPoint(0, 10) };
    expect(crossJoinPoint(wallA, wallB, 1e-9)).toBeNull();
  });

  it('returns null for parallel walls', () => {
    const wallA = { start: worldPoint(0, 0), end: worldPoint(10, 0) };
    const wallB = { start: worldPoint(0, 5), end: worldPoint(10, 5) };
    expect(crossJoinPoint(wallA, wallB, 1e-9)).toBeNull();
  });

  it("returns null when the lines would cross only outside both walls' bounds", () => {
    const wallA = { start: worldPoint(0, 5), end: worldPoint(1, 5) };
    const wallB = { start: worldPoint(5, 0), end: worldPoint(5, 1) };
    expect(crossJoinPoint(wallA, wallB, 1e-9)).toBeNull();
  });

  it('returns null for a zero-length wall (adversarial: zero-length segments)', () => {
    const degenerate = { start: worldPoint(5, 5), end: worldPoint(5, 5) };
    const wallB = { start: worldPoint(0, 0), end: worldPoint(10, 10) };
    expect(crossJoinPoint(degenerate, wallB, 1e-9)).toBeNull();
  });

  it('handles large world coordinates without losing precision (adversarial: large world coordinates)', () => {
    const offset = 1_000_000;
    const wallA = {
      start: worldPoint(offset, offset + 5),
      end: worldPoint(offset + 10, offset + 5),
    };
    const wallB = {
      start: worldPoint(offset + 5, offset),
      end: worldPoint(offset + 5, offset + 10),
    };
    const point = crossJoinPoint(wallA, wallB, 1e-9);
    expect(point?.x).toBeCloseTo(offset + 5, 6);
    expect(point?.y).toBeCloseTo(offset + 5, 6);
  });
});
