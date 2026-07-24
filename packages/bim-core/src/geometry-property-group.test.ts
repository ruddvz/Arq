import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import {
  angleMeasurement,
  areaMeasurement,
  buildGeometryPropertyGroup,
  findGeometryMeasurement,
  lengthMeasurement,
  type GeometryMeasurement,
} from './geometry-property-group';
import { calculatedProperty, inheritedProperty, missingProperty } from './property-state';
import { length } from './length';

describe('measurement constructors', () => {
  it('build a length measurement carrying its unit-tagged Length value', () => {
    expect(lengthMeasurement('height', inheritedProperty(length(2400, 'mm'), 'wt-1'))).toEqual({
      key: 'height',
      quantity: 'length',
      state: { kind: 'inherited', value: { value: 2400, unit: 'mm' }, sourceTypeId: 'wt-1' },
    });
  });

  it('build an area measurement as a plain square-metre number', () => {
    expect(areaMeasurement('area', calculatedProperty(12.5))).toEqual({
      key: 'area',
      quantity: 'area',
      state: { kind: 'calculated', value: 12.5 },
    });
  });

  it('build an angle measurement as plain radians', () => {
    expect(angleMeasurement('swingAngle', calculatedProperty(Math.PI / 2))).toEqual({
      key: 'swingAngle',
      quantity: 'angle',
      state: { kind: 'calculated', value: Math.PI / 2 },
    });
  });
});

describe('buildGeometryPropertyGroup', () => {
  it('copies the given measurements in order', () => {
    const measurements: readonly GeometryMeasurement[] = [
      lengthMeasurement('length', calculatedProperty(length(4, 'm'))),
      lengthMeasurement('thickness', inheritedProperty(length(100, 'mm'), 'wt-1')),
    ];
    const group = buildGeometryPropertyGroup(measurements);
    expect(group.measurements).toEqual(measurements);
    expect(group.measurements).not.toBe(measurements);
  });

  it('accepts an empty measurement list', () => {
    expect(buildGeometryPropertyGroup([]).measurements).toEqual([]);
  });

  it('rejects duplicate measurement keys', () => {
    const measurements: readonly GeometryMeasurement[] = [
      lengthMeasurement('height', missingProperty()),
      areaMeasurement('height', missingProperty()),
    ];
    expect(() => buildGeometryPropertyGroup(measurements)).toThrow(
      /duplicate geometry measurement key/,
    );
  });

  it('property: any list of measurements with distinct keys never throws', () => {
    fc.assert(
      fc.property(
        fc.uniqueArray(fc.string({ minLength: 1 }), { minLength: 0, maxLength: 20 }),
        (keys) => {
          const measurements = keys.map((key) => areaMeasurement(key, calculatedProperty(1)));
          expect(() => buildGeometryPropertyGroup(measurements)).not.toThrow();
        },
      ),
    );
  });

  it('property: a repeated key anywhere in the list always throws', () => {
    fc.assert(
      fc.property(
        fc.array(fc.string({ minLength: 1 }), { minLength: 1, maxLength: 10 }),
        fc.string({ minLength: 1 }),
        (keys, repeatedKey) => {
          const measurements = [...keys, repeatedKey, repeatedKey].map((key) =>
            areaMeasurement(key, calculatedProperty(1)),
          );
          expect(() => buildGeometryPropertyGroup(measurements)).toThrow();
        },
      ),
    );
  });
});

describe('findGeometryMeasurement', () => {
  it('finds a measurement by key', () => {
    const group = buildGeometryPropertyGroup([
      lengthMeasurement('length', calculatedProperty(length(4, 'm'))),
      areaMeasurement('area', calculatedProperty(9)),
    ]);
    expect(findGeometryMeasurement(group, 'area')).toEqual({
      key: 'area',
      quantity: 'area',
      state: { kind: 'calculated', value: 9 },
    });
  });

  it('returns undefined when the key is absent', () => {
    const group = buildGeometryPropertyGroup([]);
    expect(findGeometryMeasurement(group, 'area')).toBeUndefined();
  });
});
