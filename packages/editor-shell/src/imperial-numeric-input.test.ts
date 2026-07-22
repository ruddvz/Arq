import { describe, expect, it } from 'vitest';
import { parseImperialLength } from './imperial-numeric-input';

describe('parseImperialLength', () => {
  it('parses feet only', () => {
    expect(parseImperialLength("10'")).toBeCloseTo(10 * 12 * 25.4, 6);
  });

  it('parses inches only', () => {
    expect(parseImperialLength('6"')).toBeCloseTo(6 * 25.4, 6);
  });

  it('parses combined feet and inches with a space', () => {
    expect(parseImperialLength('10\' 6"')).toBeCloseTo((10 * 12 + 6) * 25.4, 6);
  });

  it('parses combined feet and inches with no space', () => {
    expect(parseImperialLength('10\'6"')).toBeCloseTo((10 * 12 + 6) * 25.4, 6);
  });

  it('parses a fractional inch', () => {
    expect(parseImperialLength('10\' 6 1/2"')).toBeCloseTo((10 * 12 + 6.5) * 25.4, 6);
  });

  it('parses a decimal inch value', () => {
    expect(parseImperialLength('6.5"')).toBeCloseTo(6.5 * 25.4, 6);
  });

  it('rejects a zero-denominator fraction', () => {
    expect(parseImperialLength('6 1/0"')).toBeNull();
  });

  it('rejects empty text and unparseable text', () => {
    expect(parseImperialLength('')).toBeNull();
    expect(parseImperialLength('abc')).toBeNull();
    expect(parseImperialLength("10'6")).toBeNull(); // missing closing inch mark
  });

  it('rejects a negative length', () => {
    expect(parseImperialLength("-10'")).toBeNull();
  });
});
