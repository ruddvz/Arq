import { describe, expect, it } from 'vitest';
import { worldPoint } from '@arq/geometry-2d';
import {
  createLinearDimension,
  linearDimensionDisplayText,
  linearDimensionIsDetached,
  measuredLinearDimensionLength,
  type LinearDimension,
} from './linear-dimension';
import { explicitPoint, wallReferenceLine } from './dimension-reference';
import { dimensionId, elementId, levelId, wallId } from './ids';
import { length } from './length';

const wall1 = wallId('wall-1');
const level1 = levelId('level-1');

function baseDimension(overrides: Partial<LinearDimension> = {}): LinearDimension {
  return createLinearDimension({
    id: dimensionId('dim-1'),
    levelId: level1,
    start: wallReferenceLine(wall1),
    end: explicitPoint(worldPoint(1000, 0)),
    offset: length(200, 'mm'),
    ...overrides,
  });
}

describe('createLinearDimension', () => {
  it('defaults precision to 0 and omits unset optional fields', () => {
    const dimension = baseDimension();
    expect(dimension.precision).toBe(0);
    expect(dimension.prefix).toBeUndefined();
    expect(dimension.suffix).toBeUndefined();
    expect(dimension.textOverride).toBeUndefined();
  });

  it('keeps a given precision and optional fields', () => {
    const dimension = baseDimension({ precision: 2, prefix: '~', suffix: ' mm', textOverride: 'see note' });
    expect(dimension.precision).toBe(2);
    expect(dimension.prefix).toBe('~');
    expect(dimension.suffix).toBe(' mm');
    expect(dimension.textOverride).toBe('see note');
  });
});

describe('measuredLinearDimensionLength', () => {
  it('measures the straight-line distance between the two resolved points', () => {
    const measured = measuredLinearDimensionLength(worldPoint(0, 0), worldPoint(3000, 4000));
    expect(measured).toEqual({ value: 5000, unit: 'mm' });
  });

  it('is unaffected by which dimension the points came from - it only sees the points', () => {
    const measured = measuredLinearDimensionLength(worldPoint(0, 0), worldPoint(1000, 0));
    expect(measured.value).toBe(1000);
  });
});

describe('linearDimensionIsDetached', () => {
  it('is false when every element-anchored reference still exists', () => {
    const dimension = baseDimension();
    expect(linearDimensionIsDetached(dimension, new Set([wall1]))).toBe(false);
  });

  it('is true when the start reference points to a wall that no longer exists', () => {
    const dimension = baseDimension();
    expect(linearDimensionIsDetached(dimension, new Set())).toBe(true);
  });

  it('is false when both references are explicit points (nothing to detach)', () => {
    const dimension = baseDimension({
      start: explicitPoint(worldPoint(0, 0)),
      end: explicitPoint(worldPoint(1, 1)),
    });
    expect(linearDimensionIsDetached(dimension, new Set())).toBe(false);
  });

  it('does not flag a dimension whose referenced wall exists among unrelated elements', () => {
    const dimension = baseDimension();
    expect(linearDimensionIsDetached(dimension, new Set([wall1, elementId('other')]))).toBe(false);
  });
});

describe('linearDimensionDisplayText', () => {
  it('formats the measured value with prefix, suffix and precision when no override is set', () => {
    const dimension = baseDimension({ precision: 2, prefix: '', suffix: ' mm' });
    const text = linearDimensionDisplayText(dimension, length(1234.567, 'mm'));
    expect(text).toBe('1234.57 mm');
  });

  it('uses no prefix/suffix when they are unset', () => {
    const dimension = baseDimension({ precision: 0 });
    expect(linearDimensionDisplayText(dimension, length(1000, 'mm'))).toBe('1000');
  });

  it('returns the textOverride verbatim, ignoring the measured value entirely', () => {
    const dimension = baseDimension({ textOverride: 'see detail 3' });
    expect(linearDimensionDisplayText(dimension, length(999999, 'mm'))).toBe('see detail 3');
  });
});
