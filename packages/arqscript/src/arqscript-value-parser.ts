/**
 * ARQ-167: ai: implement ArqScript parser.
 *
 * Parses docs/ai/ARQSCRIPT-GRAMMAR.ebnf's generic `value`, `point`,
 * `array` and `property` productions - the reusable pieces every
 * command's `{ ... }` block is built from. Lengths are converted to
 * millimetres immediately (arqscript-length.ts), since every AST
 * constructor downstream takes plain millimetre numbers.
 */

import { ArqScriptSyntaxError } from './arqscript-lexer';
import { lengthToMm } from './arqscript-length';
import type { ArqScriptPoint } from './arqscript-command';
import { TokenCursor } from './arqscript-token-cursor';

export type ParsedValue =
  | { readonly kind: 'string'; readonly value: string }
  | { readonly kind: 'number'; readonly value: number }
  | { readonly kind: 'length'; readonly valueMm: number }
  | { readonly kind: 'point'; readonly point: ArqScriptPoint }
  | { readonly kind: 'array'; readonly items: readonly ParsedValue[] };

/** `point = "point", "(", length, ",", length, ")"`. */
export function parsePoint(cursor: TokenCursor): ArqScriptPoint {
  cursor.expectIdent('point');
  cursor.expectPunct('(');
  const xMm = parseLengthMm(cursor);
  cursor.expectPunct(',');
  const yMm = parseLengthMm(cursor);
  cursor.expectPunct(')');
  return { xMm, yMm };
}

/** Reads one bare `length` token (e.g. `3000mm`), converted to millimetres - used both by parsePoint's arguments and by a statement's own bare length value (e.g. `level "L1" elevation 0mm`). */
export function parseLengthMm(cursor: TokenCursor): number {
  const token = cursor.advance();
  if (token.kind !== 'length') {
    throw new ArqScriptSyntaxError('expected a length (e.g. 3000mm)', token.position);
  }
  return lengthToMm(token.value, token.unit);
}

/** `array = "[", [ value, { ",", value } ], "]"`. */
function parseArray(cursor: TokenCursor): readonly ParsedValue[] {
  cursor.expectPunct('[');
  const items: ParsedValue[] = [];
  if (!cursor.isPunct(']')) {
    items.push(parseValue(cursor));
    while (cursor.isPunct(',')) {
      cursor.advance();
      items.push(parseValue(cursor));
    }
  }
  cursor.expectPunct(']');
  return items;
}

/** `value = string | number | length | point | array`. */
export function parseValue(cursor: TokenCursor): ParsedValue {
  const token = cursor.peek();
  if (token.kind === 'string') {
    cursor.advance();
    return { kind: 'string', value: token.value };
  }
  if (token.kind === 'length') {
    cursor.advance();
    return { kind: 'length', valueMm: lengthToMm(token.value, token.unit) };
  }
  if (token.kind === 'number') {
    cursor.advance();
    return { kind: 'number', value: token.value };
  }
  if (token.kind === 'ident' && token.value === 'point') {
    return { kind: 'point', point: parsePoint(cursor) };
  }
  if (token.kind === 'punct' && token.value === '[') {
    return { kind: 'array', items: parseArray(cursor) };
  }
  throw new ArqScriptSyntaxError('expected a value', token.position);
}

/** `property = identifier, ":", value`, repeated with no separator until "}" - matching section 98's example, where each property is on its own line with no trailing comma. Last write wins on a duplicate key. */
export function parsePropertyBlock(cursor: TokenCursor): ReadonlyMap<string, ParsedValue> {
  cursor.expectPunct('{');
  const properties = new Map<string, ParsedValue>();
  while (!cursor.isPunct('}')) {
    const key = cursor.expectAnyIdent();
    cursor.expectPunct(':');
    properties.set(key, parseValue(cursor));
  }
  cursor.expectPunct('}');
  return properties;
}

function propertyError(key: string, expected: string): never {
  throw new ArqScriptSyntaxError(`expected property "${key}" to be a ${expected}`, {
    line: 0,
    column: 0,
  });
}

export function requireStringProperty(
  properties: ReadonlyMap<string, ParsedValue>,
  key: string,
): string {
  const value = properties.get(key);
  if (value === undefined || value.kind !== 'string') {
    propertyError(key, 'string');
  }
  return value.value;
}

export function optionalStringProperty(
  properties: ReadonlyMap<string, ParsedValue>,
  key: string,
): string | undefined {
  const value = properties.get(key);
  if (value === undefined) {
    return undefined;
  }
  if (value.kind !== 'string') {
    propertyError(key, 'string');
  }
  return value.value;
}

export function requireLengthMmProperty(
  properties: ReadonlyMap<string, ParsedValue>,
  key: string,
): number {
  const value = properties.get(key);
  if (value === undefined || value.kind !== 'length') {
    propertyError(key, 'length');
  }
  return value.valueMm;
}

export function optionalLengthMmProperty(
  properties: ReadonlyMap<string, ParsedValue>,
  key: string,
): number | undefined {
  const value = properties.get(key);
  if (value === undefined) {
    return undefined;
  }
  if (value.kind !== 'length') {
    propertyError(key, 'length');
  }
  return value.valueMm;
}

export function requirePointProperty(
  properties: ReadonlyMap<string, ParsedValue>,
  key: string,
): ArqScriptPoint {
  const value = properties.get(key);
  if (value === undefined || value.kind !== 'point') {
    propertyError(key, 'point');
  }
  return value.point;
}

export function requirePointArrayProperty(
  properties: ReadonlyMap<string, ParsedValue>,
  key: string,
): readonly ArqScriptPoint[] {
  const value = properties.get(key);
  if (value === undefined || value.kind !== 'array') {
    propertyError(key, 'array of points');
  }
  return value.items.map((item) => {
    if (item.kind !== 'point') {
      propertyError(key, 'array of points');
    }
    return item.point;
  });
}
