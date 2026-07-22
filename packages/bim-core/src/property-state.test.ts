import { describe, expect, it } from 'vitest';
import {
  calculatedProperty,
  hasValue,
  importedProperty,
  inheritedProperty,
  invalidProperty,
  missingProperty,
  overriddenProperty,
  resolveOverride,
  type PropertyState,
} from './property-state';

describe('property state constructors', () => {
  it('build the expected shape for each of the six states', () => {
    expect(inheritedProperty(100, 'wt-1')).toEqual({
      kind: 'inherited',
      value: 100,
      sourceTypeId: 'wt-1',
    });
    expect(overriddenProperty(120, 'wt-1')).toEqual({
      kind: 'overridden',
      value: 120,
      sourceTypeId: 'wt-1',
    });
    expect(calculatedProperty(42)).toEqual({ kind: 'calculated', value: 42 });
    expect(importedProperty('oak', 'dxf-import-1')).toEqual({
      kind: 'imported',
      value: 'oak',
      importSource: 'dxf-import-1',
    });
    expect(missingProperty()).toEqual({ kind: 'missing' });
    expect(invalidProperty('abc', 'not a number')).toEqual({
      kind: 'invalid',
      rawValue: 'abc',
      reason: 'not a number',
    });
  });
});

describe('hasValue', () => {
  it('is true for inherited, overridden, calculated, and imported', () => {
    expect(hasValue(inheritedProperty(1, 'wt-1'))).toBe(true);
    expect(hasValue(overriddenProperty(1, 'wt-1'))).toBe(true);
    expect(hasValue(calculatedProperty(1))).toBe(true);
    expect(hasValue(importedProperty(1, 'src'))).toBe(true);
  });

  it('is false for missing and invalid', () => {
    expect(hasValue(missingProperty())).toBe(false);
    expect(hasValue(invalidProperty('x', 'bad'))).toBe(false);
  });
});

describe('resolveOverride', () => {
  it('turns an overridden state back into inherited, using the current type value', () => {
    const overridden = overriddenProperty(120, 'wt-1');
    const reset = resolveOverride(overridden, 100);
    expect(reset).toEqual({ kind: 'inherited', value: 100, sourceTypeId: 'wt-1' });
  });

  it('leaves a non-overridden state unchanged', () => {
    const inherited: PropertyState<number> = inheritedProperty(100, 'wt-1');
    expect(resolveOverride(inherited, 999)).toBe(inherited);
    const missing: PropertyState<number> = missingProperty();
    expect(resolveOverride(missing, 999)).toBe(missing);
  });
});
