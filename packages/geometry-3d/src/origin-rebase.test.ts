import { describe, expect, it } from 'vitest';
import {
  NO_REBASE_ORIGIN,
  REQUIRED_RENDER_PRECISION_MM,
  decideRebase,
  extentOfPoints3,
  float32PrecisionAt,
  maxSafeFloat32Magnitude,
  narrowToFloat32,
  rebaseStillValid,
  toModelSpace,
  toRenderSpace,
  type Extent3,
  type Point3,
} from './origin-rebase';

/** A 20m building sitting on a national grid, in millimetres: about 520km east, 6300km north. */
const GEOREFERENCED: Extent3 = {
  min: { x: 520_000_000, y: 6_300_000_000, z: 0 },
  max: { x: 520_020_000, y: 6_300_015_000, z: 12_000 },
};

/** The same building at the origin. */
const LOCAL: Extent3 = {
  min: { x: 0, y: 0, z: 0 },
  max: { x: 20_000, y: 15_000, z: 12_000 },
};

describe('float32PrecisionAt', () => {
  it('is relative to magnitude, which is the whole problem', () => {
    // ~0.06mm at 1km, ~60mm at 1000km: same 24 bits, useless at survey scale.
    expect(float32PrecisionAt(1_000_000)).toBeCloseTo(0.0625, 6);
    expect(float32PrecisionAt(1_000_000_000)).toBeCloseTo(64, 6);
  });

  it('is zero at the origin', () => {
    expect(float32PrecisionAt(0)).toBe(0);
  });

  it('does not care about sign', () => {
    expect(float32PrecisionAt(-1_000_000)).toBe(float32PrecisionAt(1_000_000));
  });

  it('agrees with what float32 actually does', () => {
    // Not a model of the loss - the loss.
    const magnitude = 520_000_000;
    const step = float32PrecisionAt(magnitude);
    expect(narrowToFloat32(magnitude + step)).not.toBe(narrowToFloat32(magnitude));
    expect(narrowToFloat32(magnitude + step / 4)).toBe(narrowToFloat32(magnitude));
  });
});

describe('maxSafeFloat32Magnitude', () => {
  it('says how far out 0.01mm survives', () => {
    // ~84m. Any real building georeferenced to a grid is far past this.
    expect(maxSafeFloat32Magnitude(REQUIRED_RENDER_PRECISION_MM)).toBeCloseTo(83_886.08, 2);
  });
});

describe('decideRebase', () => {
  it('rebases a georeferenced project', () => {
    const decision = decideRebase(GEOREFERENCED);

    expect(decision.required).toBe(true);
    expect(decision.precisionWithoutRebaseMm).toBeGreaterThan(REQUIRED_RENDER_PRECISION_MM);
    expect(decision.precisionWithRebaseMm).toBeLessThanOrEqual(REQUIRED_RENDER_PRECISION_MM);
  });

  it('leaves a project already near the origin alone', () => {
    const decision = decideRebase(LOCAL);

    expect(decision.required).toBe(false);
    expect(decision.origin).toEqual(NO_REBASE_ORIGIN);
  });

  it('centres the origin rather than parking it on a corner', () => {
    // Both bring the far corner in range; the centre halves the largest
    // remaining magnitude, which is the number precision depends on.
    const decision = decideRebase(GEOREFERENCED);

    expect(decision.origin.x).toBe(520_010_000);
    expect(decision.origin.y).toBe(6_300_007_500);
    expect(decision.origin.z).toBe(6000);
  });

  it('rounds the origin to a whole millimetre so the round trip cannot drift', () => {
    const odd: Extent3 = {
      min: { x: 520_000_001, y: 6_300_000_000, z: 0 },
      max: { x: 520_000_004, y: 6_300_000_000, z: 0 },
    };

    const decision = decideRebase(odd);

    expect(Number.isInteger(decision.origin.x)).toBe(true);
    expect(Number.isInteger(decision.origin.y)).toBe(true);
    expect(Number.isInteger(decision.origin.z)).toBe(true);
  });

  it('handles an empty scene without claiming a rebase', () => {
    const decision = decideRebase(null);

    expect(decision.required).toBe(false);
    expect(decision.origin).toEqual(NO_REBASE_ORIGIN);
  });
});

describe('toRenderSpace and toModelSpace', () => {
  it('round-trips exactly, because only the difference is ever narrowed', () => {
    const decision = decideRebase(GEOREFERENCED);
    const original: Point3 = { x: 520_012_345, y: 6_300_009_876, z: 2400 };

    const rendered = toRenderSpace(original, decision.origin);
    const returned = toModelSpace(rendered, decision.origin);

    expect(returned).toEqual(original);
  });

  it('keeps 0.01mm resolvable at survey coordinates, which is the point', () => {
    // AC3-070's failure is jitter and wrong picking. Both come from this
    // comparison: without a rebase two points 0.01mm apart collapse to one
    // float32 value, so each frame rounds differently and the ray and the
    // triangle disagree about where anything is.
    const decision = decideRebase(GEOREFERENCED);
    const a: Point3 = { x: 520_012_345, y: 6_300_009_876, z: 2400 };
    const b: Point3 = { x: 520_012_345.01, y: 6_300_009_876, z: 2400 };

    expect(narrowToFloat32(a.x)).toBe(narrowToFloat32(b.x));

    const renderedA = toRenderSpace(a, decision.origin);
    const renderedB = toRenderSpace(b, decision.origin);
    expect(narrowToFloat32(renderedA.x)).not.toBe(narrowToFloat32(renderedB.x));
  });

  it('is the identity when no rebase was needed', () => {
    const point: Point3 = { x: 1234, y: 5678, z: 90 };

    expect(toRenderSpace(point, NO_REBASE_ORIGIN)).toEqual(point);
    expect(toModelSpace(point, NO_REBASE_ORIGIN)).toEqual(point);
  });

  it('holds across a whole building at survey coordinates', () => {
    const decision = decideRebase(GEOREFERENCED);
    const corners: readonly Point3[] = [
      GEOREFERENCED.min,
      GEOREFERENCED.max,
      { x: GEOREFERENCED.min.x, y: GEOREFERENCED.max.y, z: GEOREFERENCED.max.z },
      { x: GEOREFERENCED.max.x, y: GEOREFERENCED.min.y, z: GEOREFERENCED.min.z },
    ];

    for (const corner of corners) {
      expect(toModelSpace(toRenderSpace(corner, decision.origin), decision.origin)).toEqual(corner);
    }
  });
});

describe('rebaseStillValid', () => {
  it('holds for the extent the origin was chosen from', () => {
    const decision = decideRebase(GEOREFERENCED);

    expect(rebaseStillValid(decision.origin, GEOREFERENCED)).toBe(true);
  });

  it('fails once the scene grows past what the origin covers', () => {
    // A dragged wall or an imported survey moves the extent; nothing notices
    // unless something asks.
    const decision = decideRebase(GEOREFERENCED);
    const grown: Extent3 = {
      min: GEOREFERENCED.min,
      max: { x: GEOREFERENCED.max.x + 500_000_000, y: GEOREFERENCED.max.y, z: 12_000 },
    };

    expect(rebaseStillValid(decision.origin, grown)).toBe(false);
  });
});

describe('extentOfPoints3', () => {
  it('bounds a point set', () => {
    expect(
      extentOfPoints3([
        { x: 1, y: -2, z: 3 },
        { x: -4, y: 5, z: 6 },
      ]),
    ).toEqual({ min: { x: -4, y: -2, z: 3 }, max: { x: 1, y: 5, z: 6 } });
  });

  it('returns null for no points rather than a box at the origin', () => {
    expect(extentOfPoints3([])).toBeNull();
  });
});
