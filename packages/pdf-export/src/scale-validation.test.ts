import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import {
  architecturalScaleToViewportScale,
  printedLengthMm,
  viewportScaleMatchesArchitecturalScale,
} from './scale-validation';

const POINTS_PER_MM = 72 / 25.4;

describe('architecturalScaleToViewportScale', () => {
  it('converts 1:100 to the expected points-per-mm ratio', () => {
    expect(architecturalScaleToViewportScale({ modelUnitsPerPaperUnit: 100 })).toBeCloseTo(
      POINTS_PER_MM / 100,
      10,
    );
  });

  it('converts 1:1 (full scale) to POINTS_PER_MM itself', () => {
    expect(architecturalScaleToViewportScale({ modelUnitsPerPaperUnit: 1 })).toBeCloseTo(
      POINTS_PER_MM,
      10,
    );
  });

  it('rejects a non-positive modelUnitsPerPaperUnit', () => {
    expect(() => architecturalScaleToViewportScale({ modelUnitsPerPaperUnit: 0 })).toThrow(
      /modelUnitsPerPaperUnit/,
    );
    expect(() => architecturalScaleToViewportScale({ modelUnitsPerPaperUnit: -50 })).toThrow(
      /modelUnitsPerPaperUnit/,
    );
  });

  it('rejects a non-finite modelUnitsPerPaperUnit', () => {
    expect(() =>
      architecturalScaleToViewportScale({ modelUnitsPerPaperUnit: Number.POSITIVE_INFINITY }),
    ).toThrow(/modelUnitsPerPaperUnit/);
  });
});

describe('viewportScaleMatchesArchitecturalScale', () => {
  it('is true for the exact expected ratio', () => {
    const scale = { modelUnitsPerPaperUnit: 100 };
    const viewportScale = architecturalScaleToViewportScale(scale);
    expect(viewportScaleMatchesArchitecturalScale(viewportScale, scale)).toBe(true);
  });

  it('is false for a mismatched ratio (e.g. a 1:50 viewport claimed as 1:100)', () => {
    const claimed = { modelUnitsPerPaperUnit: 100 };
    const actual = architecturalScaleToViewportScale({ modelUnitsPerPaperUnit: 50 });
    expect(viewportScaleMatchesArchitecturalScale(actual, claimed)).toBe(false);
  });

  it('respects a wider tolerance', () => {
    const scale = { modelUnitsPerPaperUnit: 100 };
    const expected = architecturalScaleToViewportScale(scale);
    const slightlyOff = expected * 1.0001;
    expect(viewportScaleMatchesArchitecturalScale(slightlyOff, scale, 1e-9)).toBe(false);
    expect(viewportScaleMatchesArchitecturalScale(slightlyOff, scale, 1e-3)).toBe(true);
  });
});

describe('printedLengthMm', () => {
  it('prints a 1000mm wall at 10mm on a 1:100 sheet', () => {
    const viewportScale = architecturalScaleToViewportScale({ modelUnitsPerPaperUnit: 100 });
    expect(printedLengthMm(1000, viewportScale)).toBeCloseTo(10, 9);
  });

  it('prints a 1000mm wall at 20mm on a 1:50 sheet', () => {
    const viewportScale = architecturalScaleToViewportScale({ modelUnitsPerPaperUnit: 50 });
    expect(printedLengthMm(1000, viewportScale)).toBeCloseTo(20, 9);
  });

  it('prints at full size on a 1:1 sheet', () => {
    const viewportScale = architecturalScaleToViewportScale({ modelUnitsPerPaperUnit: 1 });
    expect(printedLengthMm(250, viewportScale)).toBeCloseTo(250, 9);
  });

  it('property: printed length always equals worldLength / modelUnitsPerPaperUnit, for common architectural scales', () => {
    fc.assert(
      fc.property(
        fc.float({ min: Math.fround(1), max: 100000, noNaN: true }),
        fc.constantFrom(1, 5, 10, 20, 25, 50, 100, 200, 500),
        (worldLengthMm, modelUnitsPerPaperUnit) => {
          const viewportScale = architecturalScaleToViewportScale({ modelUnitsPerPaperUnit });
          const printed = printedLengthMm(worldLengthMm, viewportScale);
          expect(printed).toBeCloseTo(worldLengthMm / modelUnitsPerPaperUnit, 6);
        },
      ),
    );
  });
});
