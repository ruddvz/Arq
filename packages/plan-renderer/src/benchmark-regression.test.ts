import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { isFpsRegression, type BenchmarkBaseline } from './benchmark-regression';

const baseline: BenchmarkBaseline = { avgFps: 59.35 };

describe('isFpsRegression', () => {
  it('is false when the measured fps matches the baseline exactly', () => {
    expect(isFpsRegression(59.35, baseline, 10)).toBe(false);
  });

  it('is false for a measured fps above the baseline', () => {
    expect(isFpsRegression(60, baseline, 10)).toBe(false);
  });

  it('is false for a small drop within the threshold', () => {
    // 59.35 * 0.95 ≈ 56.38, a 5% drop - within a 10% threshold.
    expect(isFpsRegression(56.4, baseline, 10)).toBe(false);
  });

  it('is true for a drop beyond the threshold', () => {
    // 59.35 * 0.8 ≈ 47.48, a 20% drop - beyond a 10% threshold.
    expect(isFpsRegression(47, baseline, 10)).toBe(true);
  });

  it('is true exactly at the floor minus a hair, false exactly at the floor', () => {
    const floor = baseline.avgFps * 0.9;
    expect(isFpsRegression(floor, baseline, 10)).toBe(false);
    expect(isFpsRegression(floor - 0.001, baseline, 10)).toBe(true);
  });

  it('a 0% threshold treats any drop at all as a regression', () => {
    expect(isFpsRegression(baseline.avgFps - 0.01, baseline, 0)).toBe(true);
    expect(isFpsRegression(baseline.avgFps, baseline, 0)).toBe(false);
  });

  it('rejects a negative thresholdPercent', () => {
    expect(() => isFpsRegression(50, baseline, -1)).toThrow(/thresholdPercent/);
  });

  it('rejects a non-finite thresholdPercent', () => {
    expect(() => isFpsRegression(50, baseline, Number.NaN)).toThrow(/thresholdPercent/);
  });

  it('property: any measured fps at or above the baseline is never a regression, for any valid threshold', () => {
    fc.assert(
      fc.property(
        fc.float({ min: Math.fround(0), max: 1000, noNaN: true }),
        fc.float({ min: Math.fround(0), max: 100, noNaN: true }),
        (extraFps, thresholdPercent) => {
          const measured = baseline.avgFps + extraFps;
          expect(isFpsRegression(measured, baseline, thresholdPercent)).toBe(false);
        },
      ),
    );
  });
});
