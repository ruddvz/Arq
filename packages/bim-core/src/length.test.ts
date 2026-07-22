import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import {
  addLengths,
  convertLength,
  length,
  lengthsAreEqual,
  toMillimetres,
  type LengthUnit,
} from './length';

describe('toMillimetres', () => {
  it('converts every unit to millimetres correctly', () => {
    expect(toMillimetres(length(1, 'mm'))).toBe(1);
    expect(toMillimetres(length(1, 'cm'))).toBe(10);
    expect(toMillimetres(length(1, 'm'))).toBe(1000);
    expect(toMillimetres(length(1, 'in'))).toBeCloseTo(25.4, 10);
    expect(toMillimetres(length(1, 'ft'))).toBeCloseTo(304.8, 10);
  });
});

describe('convertLength', () => {
  it('round-trips through any two units without losing the physical length', () => {
    const units: readonly LengthUnit[] = ['mm', 'cm', 'm', 'in', 'ft'];
    fc.assert(
      fc.property(
        fc.float({ min: Math.fround(0.001), max: 100000, noNaN: true }),
        fc.constantFrom(...units),
        fc.constantFrom(...units),
        (value, fromUnit, toUnit) => {
          const original = length(value, fromUnit);
          const converted = convertLength(original, toUnit);
          const back = convertLength(converted, fromUnit);
          expect(toMillimetres(back)).toBeCloseTo(toMillimetres(original), 6);
        },
      ),
    );
  });

  it('converts 1 metre to 100 centimetres', () => {
    expect(convertLength(length(1, 'm'), 'cm')).toEqual({ value: 100, unit: 'cm' });
  });
});

describe('addLengths', () => {
  it("adds two lengths of different units, expressed in the first one's unit", () => {
    const result = addLengths(length(1, 'm'), length(50, 'cm'));
    expect(result).toEqual({ value: 1.5, unit: 'm' });
  });
});

describe('lengthsAreEqual', () => {
  it('treats equal physical lengths in different units as equal', () => {
    expect(lengthsAreEqual(length(1, 'm'), length(1000, 'mm'))).toBe(true);
  });

  it('treats different physical lengths as unequal', () => {
    expect(lengthsAreEqual(length(1, 'm'), length(999, 'mm'))).toBe(false);
  });

  it('respects a custom tolerance', () => {
    expect(lengthsAreEqual(length(1000, 'mm'), length(1000.5, 'mm'), 1)).toBe(true);
    expect(lengthsAreEqual(length(1000, 'mm'), length(1000.5, 'mm'), 0.1)).toBe(false);
  });
});
