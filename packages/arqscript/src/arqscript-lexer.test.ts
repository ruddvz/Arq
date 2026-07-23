import { describe, expect, it } from 'vitest';
import { ArqScriptSyntaxError, tokenize } from './arqscript-lexer';

function kinds(source: string): readonly string[] {
  return tokenize(source).map((token) => token.kind);
}

describe('tokenize', () => {
  it('lexes punctuation', () => {
    expect(kinds('{}()[]:,')).toEqual([
      'punct',
      'punct',
      'punct',
      'punct',
      'punct',
      'punct',
      'punct',
      'punct',
      'eof',
    ]);
  });

  it('lexes a string literal', () => {
    const tokens = tokenize('"Ground Floor"');
    expect(tokens[0]).toEqual({
      kind: 'string',
      value: 'Ground Floor',
      position: { line: 1, column: 1 },
    });
  });

  it('handles a backslash-escaped quote inside a string', () => {
    const tokens = tokenize('"say \\"hi\\""');
    expect(tokens[0]).toMatchObject({ kind: 'string', value: 'say "hi"' });
  });

  it('throws ArqScriptSyntaxError for an unterminated string', () => {
    expect(() => tokenize('"unterminated')).toThrow(ArqScriptSyntaxError);
  });

  it('lexes a bare number with no unit suffix', () => {
    const tokens = tokenize('42');
    expect(tokens[0]).toEqual({ kind: 'number', value: 42, position: { line: 1, column: 1 } });
  });

  it('lexes a length (number with an immediate unit suffix)', () => {
    const tokens = tokenize('3000mm');
    expect(tokens[0]).toEqual({
      kind: 'length',
      value: 3000,
      unit: 'mm',
      position: { line: 1, column: 1 },
    });
  });

  it('lexes every grammar unit suffix', () => {
    for (const unit of ['mm', 'cm', 'm', 'in', 'ft']) {
      const tokens = tokenize(`1${unit}`);
      expect(tokens[0]).toMatchObject({ kind: 'length', unit });
    }
  });

  it('lexes a negative number', () => {
    const tokens = tokenize('-150mm');
    expect(tokens[0]).toEqual({
      kind: 'length',
      value: -150,
      unit: 'mm',
      position: { line: 1, column: 1 },
    });
  });

  it('lexes a decimal number', () => {
    const tokens = tokenize('2.5m');
    expect(tokens[0]).toMatchObject({ kind: 'length', value: 2.5, unit: 'm' });
  });

  it('throws ArqScriptSyntaxError for an unrecognized unit suffix', () => {
    expect(() => tokenize('3000xyz')).toThrow(ArqScriptSyntaxError);
  });

  it('lexes identifiers, including underscores and digits after the first character', () => {
    const tokens = tokenize('wall_1');
    expect(tokens[0]).toEqual({ kind: 'ident', value: 'wall_1', position: { line: 1, column: 1 } });
  });

  it('skips whitespace including newlines, tracking line/column', () => {
    const tokens = tokenize('a\n  b');
    expect(tokens[0]).toMatchObject({ position: { line: 1, column: 1 } });
    expect(tokens[1]).toMatchObject({ position: { line: 2, column: 3 } });
  });

  it('throws ArqScriptSyntaxError for an unexpected character', () => {
    expect(() => tokenize('#')).toThrow(ArqScriptSyntaxError);
  });

  it('tokenizes the full section-98 example without throwing', () => {
    const source = `version "0.1"

level "Ground Floor" elevation 0mm

wall "W1" {
  from: point(0mm, 0mm)
  to: point(6000mm, 0mm)
  type: "Exterior 230"
  height: 3000mm
}

door "D1" {
  host: "W1"
  width: 900mm
  height: 2100mm
  offset: 1200mm
}`;
    expect(() => tokenize(source)).not.toThrow();
    expect(kinds(source).at(-1)).toBe('eof');
  });
});
