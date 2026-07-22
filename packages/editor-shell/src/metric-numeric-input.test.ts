import { describe, expect, it } from 'vitest';
import { parseMetricLength } from './metric-numeric-input';

describe('parseMetricLength', () => {
  it('defaults an unsuffixed number to millimetres', () => {
    expect(parseMetricLength('350')).toBe(350);
  });

  it('parses an explicit mm suffix, case-insensitively and with optional whitespace', () => {
    expect(parseMetricLength('350mm')).toBe(350);
    expect(parseMetricLength('350 MM')).toBe(350);
  });

  it('converts cm and m suffixes to millimetres', () => {
    expect(parseMetricLength('35cm')).toBe(350);
    expect(parseMetricLength('3.5m')).toBe(3500);
  });

  it('accepts a decimal value', () => {
    expect(parseMetricLength('12.5mm')).toBeCloseTo(12.5, 10);
  });

  it('rejects a negative length', () => {
    expect(parseMetricLength('-5mm')).toBeNull();
  });

  it('rejects empty text and unparseable text', () => {
    expect(parseMetricLength('')).toBeNull();
    expect(parseMetricLength('abc')).toBeNull();
    expect(parseMetricLength('5 feet')).toBeNull();
  });
});
