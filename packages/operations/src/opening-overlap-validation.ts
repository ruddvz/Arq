/**
 * ARQ-109: implement opening overlap validation.
 *
 * Turns bim-core's findOverlappingOpenings (opening.ts, ARQ-109's pure
 * half - overlap detection needs nothing but the Openings themselves,
 * so it lives with the rest of Opening's section 48 rules, not here)
 * into the ValidationMessage shape (validation-result.ts, ARQ-066) an
 * OperationResult already carries. This is the layer boundary bim-core
 * itself cannot cross: ValidationMessage lives in @arq/operations,
 * which depends on @arq/bim-core, not the other way round.
 *
 * One ValidationMessage per overlapping pair, severity 'error' -
 * "overlaps are blocking by default" (section 48) - naming both
 * openings in affectedElementIds so a caller can highlight both without
 * re-deriving which pair failed.
 *
 * Escape/Enter: this is a pure validation query over an already-decided
 * set of Openings, not an interactive command - there is no preview to
 * cancel or commit, the same as openingFitsWallLength/openingFitsWallHeight
 * (bim-core's opening.ts) it sits alongside. Invalid input leaves
 * committed project state unchanged because this function does not
 * touch project state at all: it is the caller's job (whichever
 * operation creates or moves an Opening) to check hasErrors() on this
 * function's result before applying anything, the same pattern
 * update-property-operation.ts's ELEMENT_NOT_FOUND rejection already
 * establishes for a different rule.
 */

import { findOverlappingOpenings, type Opening } from '@arq/bim-core';
import type { ValidationMessage } from './validation-result';

/** Section 48: "overlaps are blocking by default" - one error-severity ValidationMessage per overlapping pair among `openings`. */
export function validateOpeningOverlaps(
  openings: readonly Opening[],
  toleranceMm = 1e-6,
): readonly ValidationMessage[] {
  return findOverlappingOpenings(openings, toleranceMm).map(([a, b]) => ({
    id: `opening-overlap-${a.id}-${b.id}`,
    severity: 'error',
    code: 'OPENING_OVERLAP',
    title: 'Openings overlap',
    explanation: `Opening "${a.id}" and opening "${b.id}" overlap on the same host wall.`,
    affectedElementIds: [a.id, b.id],
    suggestedActions: ['Move one opening so their spans no longer intersect.'],
  }));
}
