import { describe, expect, it } from 'vitest';
import { worldPoint } from '@arq/geometry-2d';
import {
  dimensionReferenceElementId,
  dimensionReferenceIsDetached,
  explicitPoint,
  openingCentre,
  openingEdge,
  wallFace,
  wallReferenceLine,
  type DimensionReference,
} from './dimension-reference';
import { openingId, wallId } from './ids';

const wall1 = wallId('wall-1');
const opening1 = openingId('opening-1');

describe('reference constructors', () => {
  it('build each of the five reference kinds', () => {
    expect(wallReferenceLine(wall1)).toEqual({ kind: 'wall-reference-line', wallId: wall1 });
    expect(wallFace(wall1, 'interior')).toEqual({
      kind: 'wall-face',
      wallId: wall1,
      side: 'interior',
    });
    expect(openingCentre(opening1)).toEqual({ kind: 'opening-centre', openingId: opening1 });
    expect(openingEdge(opening1, 'start')).toEqual({
      kind: 'opening-edge',
      openingId: opening1,
      edge: 'start',
    });
    expect(explicitPoint(worldPoint(1, 2))).toEqual({
      kind: 'explicit-point',
      point: worldPoint(1, 2),
    });
  });
});

describe('dimensionReferenceElementId', () => {
  it('returns the wallId for wall-anchored references', () => {
    expect(dimensionReferenceElementId(wallReferenceLine(wall1))).toBe(wall1);
    expect(dimensionReferenceElementId(wallFace(wall1, 'exterior'))).toBe(wall1);
  });

  it('returns the openingId for opening-anchored references', () => {
    expect(dimensionReferenceElementId(openingCentre(opening1))).toBe(opening1);
    expect(dimensionReferenceElementId(openingEdge(opening1, 'end'))).toBe(opening1);
  });

  it('returns null for an explicit-point reference', () => {
    expect(dimensionReferenceElementId(explicitPoint(worldPoint(0, 0)))).toBeNull();
  });
});

describe('dimensionReferenceIsDetached', () => {
  it('is false when the referenced element still exists', () => {
    const reference = wallReferenceLine(wall1);
    expect(dimensionReferenceIsDetached(reference, new Set([wall1]))).toBe(false);
  });

  it('is true when the referenced element no longer exists', () => {
    const reference = wallReferenceLine(wall1);
    expect(dimensionReferenceIsDetached(reference, new Set())).toBe(true);
  });

  it('is true when only a different element exists', () => {
    const reference = openingCentre(opening1);
    expect(dimensionReferenceIsDetached(reference, new Set([wall1]))).toBe(true);
  });

  it('is always false for an explicit-point reference, regardless of existing elements', () => {
    const reference: DimensionReference = explicitPoint(worldPoint(5, 5));
    expect(dimensionReferenceIsDetached(reference, new Set())).toBe(false);
  });
});
