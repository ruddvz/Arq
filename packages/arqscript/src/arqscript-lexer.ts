/**
 * ARQ-167: ai: implement ArqScript parser.
 *
 * Tokenizes ArqScript v0 source text per docs/ai/ARQSCRIPT-GRAMMAR.ebnf.
 * A `length` token (a number immediately followed, with no whitespace, by
 * one of the grammar's five unit suffixes - `mm`, `cm`, `m`, `in`, `ft`)
 * is lexed as its own kind rather than a plain number, since the grammar
 * treats `length = number, unit` as one terminal, not two adjacent ones.
 *
 * Deliberately hand-written, not a lexer-generator library: this issue's
 * own non-goal rules out an unreviewed dependency, and ArqScript v0's
 * token set (five punctuation characters, strings, numbers/lengths,
 * identifiers) is simple enough not to need one - the same reasoning
 * @arq/dxf-adapter's dxf-tokenizer.ts already used for DXF's group-code
 * format.
 *
 * `tokenize` itself can throw an `ArqScriptSyntaxError` for a source
 * character it cannot lex at all (an unterminated string, a stray
 * symbol) - this is caught and turned into a well-formed rejected result
 * one layer up, in arqscript-parser.ts's `parseArqScript`, the same
 * safe-failure boundary `@arq/dxf-adapter`'s `parseDxf` and
 * `@arq/project-format`'s `importArchive` already use for untrusted text/
 * bytes. AI guardrail "No arbitrary code execution"
 * (docs/ai/AI-GUARDRAILS.md) is upheld trivially: this is a plain text
 * tokenizer with no `eval`, `Function`, or dynamic code path anywhere.
 */

export type LengthUnit = 'mm' | 'cm' | 'm' | 'in' | 'ft';

const LENGTH_UNITS: readonly LengthUnit[] = ['mm', 'cm', 'm', 'in', 'ft'];

export interface SourcePosition {
  readonly line: number;
  readonly column: number;
}

export type ArqScriptToken =
  | { readonly kind: 'string'; readonly value: string; readonly position: SourcePosition }
  | { readonly kind: 'number'; readonly value: number; readonly position: SourcePosition }
  | {
      readonly kind: 'length';
      readonly value: number;
      readonly unit: LengthUnit;
      readonly position: SourcePosition;
    }
  | { readonly kind: 'ident'; readonly value: string; readonly position: SourcePosition }
  | { readonly kind: 'punct'; readonly value: string; readonly position: SourcePosition }
  | { readonly kind: 'eof'; readonly position: SourcePosition };

export class ArqScriptSyntaxError extends Error {
  constructor(
    message: string,
    readonly position: SourcePosition,
  ) {
    super(`${message} at line ${position.line}, column ${position.column}`);
    this.name = 'ArqScriptSyntaxError';
  }
}

const PUNCTUATION = new Set(['{', '}', '(', ')', '[', ']', ':', ',']);

function isDigit(char: string): boolean {
  return char >= '0' && char <= '9';
}

function isIdentStart(char: string): boolean {
  return /[A-Za-z_]/.test(char);
}

function isIdentContinue(char: string): boolean {
  return /[A-Za-z0-9_]/.test(char);
}

/** Tokenizes ArqScript source text. Throws ArqScriptSyntaxError on the first character it cannot lex - caught one layer up by parseArqScript. */
export function tokenize(source: string): readonly ArqScriptToken[] {
  const tokens: ArqScriptToken[] = [];
  let index = 0;
  let line = 1;
  let column = 1;

  function position(): SourcePosition {
    return { line, column };
  }

  function advance(): string {
    const char = source[index];
    if (char === undefined) {
      throw new ArqScriptSyntaxError('unexpected end of input', position());
    }
    index += 1;
    if (char === '\n') {
      line += 1;
      column = 1;
    } else {
      column += 1;
    }
    return char;
  }

  function peek(offset = 0): string | undefined {
    return source[index + offset];
  }

  while (index < source.length) {
    const char = peek();
    if (char === undefined) {
      break;
    }

    if (char === ' ' || char === '\t' || char === '\r' || char === '\n') {
      advance();
      continue;
    }

    if (PUNCTUATION.has(char)) {
      const start = position();
      advance();
      tokens.push({ kind: 'punct', value: char, position: start });
      continue;
    }

    if (char === '"') {
      const start = position();
      advance();
      let value = '';
      for (;;) {
        const next = peek();
        if (next === undefined) {
          throw new ArqScriptSyntaxError('unterminated string literal', start);
        }
        if (next === '"') {
          advance();
          break;
        }
        if (next === '\\') {
          advance();
          const escaped = peek();
          if (escaped === undefined) {
            throw new ArqScriptSyntaxError('unterminated string literal', start);
          }
          advance();
          value += escaped === 'n' ? '\n' : escaped;
          continue;
        }
        value += advance();
      }
      tokens.push({ kind: 'string', value, position: start });
      continue;
    }

    if (isDigit(char) || (char === '-' && peek(1) !== undefined && isDigit(peek(1) as string))) {
      const start = position();
      let numberText = advance();
      while (peek() !== undefined && (isDigit(peek() as string) || peek() === '.')) {
        numberText += advance();
      }
      const value = Number.parseFloat(numberText);
      if (!Number.isFinite(value)) {
        throw new ArqScriptSyntaxError(`invalid number literal "${numberText}"`, start);
      }

      let unitText = '';
      while (peek() !== undefined && /[A-Za-z]/.test(peek() as string)) {
        unitText += advance();
      }
      if (unitText.length === 0) {
        tokens.push({ kind: 'number', value, position: start });
        continue;
      }
      if (!LENGTH_UNITS.includes(unitText as LengthUnit)) {
        throw new ArqScriptSyntaxError(`unknown length unit "${unitText}"`, start);
      }
      tokens.push({ kind: 'length', value, unit: unitText as LengthUnit, position: start });
      continue;
    }

    if (isIdentStart(char)) {
      const start = position();
      let value = advance();
      while (peek() !== undefined && isIdentContinue(peek() as string)) {
        value += advance();
      }
      tokens.push({ kind: 'ident', value, position: start });
      continue;
    }

    throw new ArqScriptSyntaxError(`unexpected character "${char}"`, position());
  }

  tokens.push({ kind: 'eof', position: position() });
  return tokens;
}
