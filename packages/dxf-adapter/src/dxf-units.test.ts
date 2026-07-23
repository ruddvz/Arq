import { describe, expect, it } from 'vitest';
import { resolveDxfUnits } from './dxf-units';

describe('resolveDxfUnits', () => {
  it('resolves each recognized $INSUNITS code', () => {
    expect(resolveDxfUnits(0)).toBe('unitless');
    expect(resolveDxfUnits(1)).toBe('inches');
    expect(resolveDxfUnits(2)).toBe('feet');
    expect(resolveDxfUnits(4)).toBe('millimeters');
    expect(resolveDxfUnits(5)).toBe('centimeters');
    expect(resolveDxfUnits(6)).toBe('meters');
  });

  it('resolves an unrecognized code to unspecified', () => {
    expect(resolveDxfUnits(19)).toBe('unspecified');
  });

  it('resolves a missing code to unspecified', () => {
    expect(resolveDxfUnits(undefined)).toBe('unspecified');
  });
});
