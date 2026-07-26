import { describe, expect, it } from 'vitest';
import { lineWeightToDevicePixels, snapStrokeCenter } from './line-weight';

describe('lineWeightToDevicePixels', () => {
  it('scales the hairline tier by devicePixelRatio', () => {
    expect(lineWeightToDevicePixels('hairline', 1)).toBeCloseTo(1, 9);
    expect(lineWeightToDevicePixels('hairline', 2)).toBeCloseTo(2, 9);
  });

  it('scales the heavy tier by devicePixelRatio', () => {
    expect(lineWeightToDevicePixels('heavy', 1)).toBeCloseTo(4, 9);
    expect(lineWeightToDevicePixels('heavy', 2)).toBeCloseTo(8, 9);
  });

  it('is monotonically increasing across tiers at a fixed devicePixelRatio (a stable hierarchy)', () => {
    const tiers = ['hairline', 'thin', 'regular', 'medium', 'heavy'] as const;
    const widths = tiers.map((tier) => lineWeightToDevicePixels(tier, 1));
    for (let i = 1; i < widths.length; i += 1) {
      expect(widths[i]!).toBeGreaterThan(widths[i - 1]!);
    }
  });

  it('remains monotonically increasing at a high devicePixelRatio too', () => {
    const tiers = ['hairline', 'thin', 'regular', 'medium', 'heavy'] as const;
    const widths = tiers.map((tier) => lineWeightToDevicePixels(tier, 3));
    for (let i = 1; i < widths.length; i += 1) {
      expect(widths[i]!).toBeGreaterThan(widths[i - 1]!);
    }
  });

  it('floors at 1 device pixel for a devicePixelRatio below 1, rather than letting a tier vanish', () => {
    expect(lineWeightToDevicePixels('hairline', 0.4)).toBe(1);
  });

  it('rejects a non-positive devicePixelRatio', () => {
    expect(() => lineWeightToDevicePixels('regular', 0)).toThrow(RangeError);
    expect(() => lineWeightToDevicePixels('regular', -1)).toThrow(RangeError);
  });

  it('rejects a non-finite devicePixelRatio (adversarial: non-finite values)', () => {
    expect(() => lineWeightToDevicePixels('regular', Number.NaN)).toThrow(RangeError);
    expect(() => lineWeightToDevicePixels('regular', Number.POSITIVE_INFINITY)).toThrow(RangeError);
  });
});

describe('snapStrokeCenter', () => {
  it('snaps a 1px-wide stroke to the nearest half-pixel boundary', () => {
    expect(snapStrokeCenter(10.2, 1)).toBe(10.5);
    expect(snapStrokeCenter(9.6, 1)).toBe(9.5);
    expect(snapStrokeCenter(10.5, 1)).toBe(10.5);
  });

  it('snaps a 2px-wide stroke to the nearest whole-pixel boundary', () => {
    expect(snapStrokeCenter(10.2, 2)).toBe(10);
    expect(snapStrokeCenter(10.6, 2)).toBe(11);
  });

  it('snaps a 3px-wide (odd) stroke the same way as a 1px stroke', () => {
    expect(snapStrokeCenter(10.2, 3)).toBe(10.5);
  });

  it('leaves an already-snapped coordinate unchanged', () => {
    expect(snapStrokeCenter(10.5, 1)).toBe(10.5);
    expect(snapStrokeCenter(10, 2)).toBe(10);
  });

  it('moves the coordinate by at most half a device pixel', () => {
    for (let x = 0; x < 5; x += 0.1) {
      const snapped = snapStrokeCenter(x, 1);
      expect(Math.abs(snapped - x)).toBeLessThanOrEqual(0.5 + 1e-9);
    }
  });
});
