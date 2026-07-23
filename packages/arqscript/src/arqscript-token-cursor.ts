/**
 * ARQ-167: ai: implement ArqScript parser.
 *
 * A minimal, mutable-position cursor over tokenize()'s output - shared by
 * arqscript-value-parser.ts and arqscript-parser.ts so both work over the
 * same token stream without threading an index parameter through every
 * function by hand. Every `expect*` method throws ArqScriptSyntaxError
 * (never returns undefined) on a mismatch, caught one layer up by
 * parseArqScript, same safe-failure boundary as the lexer.
 */

import { ArqScriptSyntaxError, type ArqScriptToken, type SourcePosition } from './arqscript-lexer';

export class TokenCursor {
  private position = 0;

  constructor(private readonly tokens: readonly ArqScriptToken[]) {}

  peek(): ArqScriptToken {
    const token = this.tokens[this.position];
    if (token === undefined) {
      throw new ArqScriptSyntaxError('unexpected end of input', this.lastPosition());
    }
    return token;
  }

  private lastPosition(): SourcePosition {
    return this.tokens.at(-1)?.position ?? { line: 1, column: 1 };
  }

  advance(): ArqScriptToken {
    const token = this.peek();
    this.position += 1;
    return token;
  }

  isEof(): boolean {
    return this.peek().kind === 'eof';
  }

  isPunct(value: string): boolean {
    const token = this.peek();
    return token.kind === 'punct' && token.value === value;
  }

  isIdent(value: string): boolean {
    const token = this.peek();
    return token.kind === 'ident' && token.value === value;
  }

  expectPunct(value: string): void {
    if (!this.isPunct(value)) {
      throw new ArqScriptSyntaxError(`expected "${value}"`, this.peek().position);
    }
    this.advance();
  }

  expectIdent(value: string): void {
    if (!this.isIdent(value)) {
      throw new ArqScriptSyntaxError(`expected "${value}"`, this.peek().position);
    }
    this.advance();
  }

  /** Consumes and returns any identifier's text, regardless of value. */
  expectAnyIdent(): string {
    const token = this.peek();
    if (token.kind !== 'ident') {
      throw new ArqScriptSyntaxError('expected an identifier', token.position);
    }
    this.advance();
    return token.value;
  }

  expectString(): string {
    const token = this.peek();
    if (token.kind !== 'string') {
      throw new ArqScriptSyntaxError('expected a string literal', token.position);
    }
    this.advance();
    return token.value;
  }
}
