import { describe, expect, it } from 'vitest';
import { length, toMillimetres } from './length';
import { formatTypedLength, isPartialTypedLength, parseTypedLength } from './parse-typed-length';

function parsed(text: string, defaultUnit: Parameters<typeof parseTypedLength>[1] = 'mm') {
  const outcome = parseTypedLength(text, defaultUnit);
  if (outcome.status !== 'parsed') {
    throw new Error(`expected ${text} to parse, got ${outcome.reason}`);
  }
  return outcome.length;
}

describe('parseTypedLength', () => {
  it('keeps the unit the user typed rather than converting it away', () => {
    // Someone who types 3m and sees 3000 back has been told their input was
    // wrong when it was not.
    expect(parsed('3m')).toEqual({ value: 3, unit: 'm' });
    expect(parsed('250mm')).toEqual({ value: 250, unit: 'mm' });
    expect(parsed('12.5cm')).toEqual({ value: 12.5, unit: 'cm' });
    expect(parsed('18in')).toEqual({ value: 18, unit: 'in' });
  });

  it('accepts whitespace between the number and the unit', () => {
    expect(parsed('3 m')).toEqual({ value: 3, unit: 'm' });
  });

  it('is case insensitive about the unit', () => {
    expect(parsed('3M')).toEqual({ value: 3, unit: 'm' });
    expect(parsed('250MM')).toEqual({ value: 250, unit: 'mm' });
  });

  it('resolves a bare number against the unit the caller supplies, never one of its own', () => {
    // A bare 3 means 3mm in a metric project and something else entirely
    // elsewhere. A parser that picks for itself is how a dimension ends up
    // three hundred times wrong with nothing reporting a problem.
    expect(parsed('3', 'mm')).toEqual({ value: 3, unit: 'mm' });
    expect(parsed('3', 'm')).toEqual({ value: 3, unit: 'm' });
    expect(parsed('3', 'ft')).toEqual({ value: 3, unit: 'ft' });
  });

  it('parses feet and inches in the notation the trade writes', () => {
    expect(toMillimetres(parsed("10'"))).toBeCloseTo(3048, 6);
    expect(toMillimetres(parsed('6"'))).toBeCloseTo(152.4, 6);
    expect(toMillimetres(parsed('10\' 6"'))).toBeCloseTo(3200.4, 6);
    expect(toMillimetres(parsed('10\'6"'))).toBeCloseTo(3200.4, 6);
  });

  it('parses a fractional inch', () => {
    expect(toMillimetres(parsed('10\' 6 1/2"'))).toBeCloseTo(3213.1, 6);
  });

  it('expresses feet-and-inches in feet, the unit the notation is written in', () => {
    expect(parsed('10\' 6"')).toEqual({ value: 10.5, unit: 'ft' });
  });

  it('rejects an empty field distinctly from a malformed one', () => {
    expect(parseTypedLength('   ', 'mm')).toEqual({ status: 'rejected', reason: 'empty' });
    expect(parseTypedLength('abc', 'mm')).toEqual({ status: 'rejected', reason: 'malformed' });
  });

  it('rejects a negative length rather than inventing a meaning for the sign', () => {
    expect(parseTypedLength('-3m', 'mm')).toEqual({ status: 'rejected', reason: 'negative' });
  });

  it('rejects a unit it does not know', () => {
    expect(parseTypedLength('3km', 'mm')).toEqual({ status: 'rejected', reason: 'unknown-unit' });
    expect(parseTypedLength('3yd', 'mm')).toEqual({ status: 'rejected', reason: 'unknown-unit' });
  });

  it('rejects a fraction over zero', () => {
    expect(parseTypedLength('6 1/0"', 'mm')).toEqual({
      status: 'rejected',
      reason: 'zero-denominator',
    });
  });

  it('rejects a stray quote with no number', () => {
    expect(parseTypedLength("'", 'mm').status).toBe('rejected');
    expect(parseTypedLength('"', 'mm').status).toBe('rejected');
  });

  it('gives a reason a surface can explain, not just a null', () => {
    const outcome = parseTypedLength('3km', 'mm');

    expect(outcome.status).toBe('rejected');
    if (outcome.status !== 'rejected') return;
    expect(outcome.reason).toBe('unknown-unit');
  });
});

describe('isPartialTypedLength', () => {
  it('accepts every prefix of a value on its way to being typed', () => {
    // Without this a field cannot accept "3m" at all: "3" parses, and a caller
    // holding only the parser would have to commit or reject per keystroke.
    for (const prefix of ['', '3', '3.', '3.5', '3.5 ', '3.5c', '3.5cm']) {
      expect(isPartialTypedLength(prefix)).toBe(true);
    }
  });

  it('accepts a feet-and-inches value mid-entry', () => {
    for (const prefix of ['10', "10'", "10' ", "10' 6", '10\' 6"']) {
      expect(isPartialTypedLength(prefix)).toBe(true);
    }
  });

  it('rejects text that can never become a length', () => {
    expect(isPartialTypedLength('3km')).toBe(false);
    expect(isPartialTypedLength('hello')).toBe(false);
  });
});

describe('formatTypedLength', () => {
  it('renders a metric length with its own unit', () => {
    expect(formatTypedLength(length(3, 'm'))).toBe('3m');
    expect(formatTypedLength(length(12.5, 'cm'))).toBe('12.5cm');
  });

  it('renders feet in feet-and-inches, not as a decimal nobody writes', () => {
    expect(formatTypedLength(length(10.5, 'ft'))).toBe('10\' 6"');
    expect(formatTypedLength(length(10, 'ft'))).toBe("10'");
  });

  it('renders a fractional inch in lowest terms', () => {
    // 10' 6 1/2" - 8/16 reduced, not left as 8/16.
    expect(formatTypedLength(length(10 + 6.5 / 12, 'ft'))).toBe('10\' 6 1/2"');
  });

  it('rounds up to the next whole inch rather than printing 16/16', () => {
    expect(formatTypedLength(length(10 + 6.99 / 12, 'ft'))).toBe('10\' 7"');
  });

  it('round-trips what a user typed', () => {
    expect(formatTypedLength(parsed('10\' 6"'))).toBe('10\' 6"');
    expect(formatTypedLength(parsed('3m'))).toBe('3m');
  });
});
