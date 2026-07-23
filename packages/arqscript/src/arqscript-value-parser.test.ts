import { describe, expect, it } from 'vitest';
import { tokenize } from './arqscript-lexer';
import { TokenCursor } from './arqscript-token-cursor';
import {
  optionalLengthMmProperty,
  optionalStringProperty,
  parsePoint,
  parsePropertyBlock,
  parseValue,
  requireLengthMmProperty,
  requirePointArrayProperty,
  requirePointProperty,
  requireStringProperty,
} from './arqscript-value-parser';

function cursorFor(source: string): TokenCursor {
  return new TokenCursor(tokenize(source));
}

describe('parseValue', () => {
  it('parses a string value', () => {
    expect(parseValue(cursorFor('"hello"'))).toEqual({ kind: 'string', value: 'hello' });
  });

  it('parses a length value, converted to millimetres', () => {
    expect(parseValue(cursorFor('1m'))).toEqual({ kind: 'length', valueMm: 1000 });
  });

  it('parses a bare number value', () => {
    expect(parseValue(cursorFor('42'))).toEqual({ kind: 'number', value: 42 });
  });

  it('parses a point value', () => {
    expect(parseValue(cursorFor('point(0mm, 6000mm)'))).toEqual({
      kind: 'point',
      point: { xMm: 0, yMm: 6000 },
    });
  });

  it('parses an array value', () => {
    expect(parseValue(cursorFor('[1mm, 2mm]'))).toEqual({
      kind: 'array',
      items: [
        { kind: 'length', valueMm: 1 },
        { kind: 'length', valueMm: 2 },
      ],
    });
  });

  it('parses an empty array', () => {
    expect(parseValue(cursorFor('[]'))).toEqual({ kind: 'array', items: [] });
  });

  it('throws for an unrecognized value', () => {
    expect(() => parseValue(cursorFor('{'))).toThrow();
  });
});

describe('parsePoint', () => {
  it('rejects a malformed point missing the closing paren', () => {
    expect(() => parsePoint(cursorFor('point(0mm, 0mm'))).toThrow();
  });
});

describe('parsePropertyBlock', () => {
  it("parses a block with no comma separators, matching section 98's example", () => {
    const block = parsePropertyBlock(
      cursorFor(`{
        from: point(0mm, 0mm)
        to: point(6000mm, 0mm)
        type: "Exterior 230"
        height: 3000mm
      }`),
    );
    expect(block.get('type')).toEqual({ kind: 'string', value: 'Exterior 230' });
    expect(block.get('height')).toEqual({ kind: 'length', valueMm: 3000 });
  });

  it('parses an empty block', () => {
    expect(parsePropertyBlock(cursorFor('{}')).size).toBe(0);
  });

  it('last value wins for a duplicate key', () => {
    const block = parsePropertyBlock(cursorFor('{ height: 100mm height: 200mm }'));
    expect(block.get('height')).toEqual({ kind: 'length', valueMm: 200 });
  });
});

describe('property accessors', () => {
  const block = parsePropertyBlock(
    cursorFor(`{
      name: "Kitchen"
      height: 3000mm
      boundary: [point(0mm, 0mm), point(4000mm, 0mm)]
    }`),
  );

  it('requireStringProperty reads a present string', () => {
    expect(requireStringProperty(block, 'name')).toBe('Kitchen');
  });

  it('requireStringProperty throws when the property is missing', () => {
    expect(() => requireStringProperty(block, 'missing')).toThrow();
  });

  it('requireStringProperty throws when the property has the wrong kind', () => {
    expect(() => requireStringProperty(block, 'height')).toThrow();
  });

  it('optionalStringProperty returns undefined when missing, without throwing', () => {
    expect(optionalStringProperty(block, 'missing')).toBeUndefined();
  });

  it('requireLengthMmProperty reads a present length in millimetres', () => {
    expect(requireLengthMmProperty(block, 'height')).toBe(3000);
  });

  it('optionalLengthMmProperty returns undefined when missing', () => {
    expect(optionalLengthMmProperty(block, 'missing')).toBeUndefined();
  });

  it('requirePointProperty throws for a non-point property', () => {
    expect(() => requirePointProperty(block, 'name')).toThrow();
  });

  it('requirePointArrayProperty reads an array of points', () => {
    expect(requirePointArrayProperty(block, 'boundary')).toEqual([
      { xMm: 0, yMm: 0 },
      { xMm: 4000, yMm: 0 },
    ]);
  });

  it('requirePointArrayProperty throws when an array item is not a point', () => {
    const badBlock = parsePropertyBlock(cursorFor('{ boundary: [1mm, 2mm] }'));
    expect(() => requirePointArrayProperty(badBlock, 'boundary')).toThrow();
  });
});
