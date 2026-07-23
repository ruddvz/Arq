import { describe, expect, it } from 'vitest';
import { lengthToMm } from './arqscript-length';

describe('lengthToMm', () => {
  it('passes millimetres through unchanged', () => {
    expect(lengthToMm(3000, 'mm')).toBe(3000);
  });

  it('converts centimetres', () => {
    expect(lengthToMm(1, 'cm')).toBe(10);
  });

  it('converts metres', () => {
    expect(lengthToMm(1, 'm')).toBe(1000);
  });

  it('converts inches', () => {
    expect(lengthToMm(1, 'in')).toBeCloseTo(25.4);
  });

  it('converts feet', () => {
    expect(lengthToMm(1, 'ft')).toBeCloseTo(304.8);
  });

  it('handles a negative value', () => {
    expect(lengthToMm(-150, 'mm')).toBe(-150);
  });
});
