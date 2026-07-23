/**
 * ARQ-167: ai: implement ArqScript parser.
 *
 * Converts a lexed `length` token (docs/ai/ARQSCRIPT-GRAMMAR.ebnf's
 * `length = number, unit`) into millimetres, matching every AST
 * constructor in arqscript-command.ts, which all take plain millimetre
 * numbers (e.g. `heightMm`).
 */

import type { LengthUnit } from './arqscript-lexer';

const MM_PER_UNIT: Readonly<Record<LengthUnit, number>> = {
  mm: 1,
  cm: 10,
  m: 1000,
  in: 25.4,
  ft: 304.8,
};

export function lengthToMm(value: number, unit: LengthUnit): number {
  return value * MM_PER_UNIT[unit];
}
