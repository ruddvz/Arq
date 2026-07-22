/**
 * ARQ-081: define tolerance policy.
 *
 * Blueprint section 40 ("Tolerance policy") names seven tolerances and
 * lays out rules: tolerance is explicit at API boundaries; no random
 * 1e-6 values in feature code; equality functions state whether they
 * are exact or tolerant; regression files cover near-degenerate cases.
 *
 * DEFAULT_TOLERANCES's actual numeric magnitudes are provisional
 * placeholders, not a calibrated product decision - real values need
 * domain research (the interview programme, docs/research/
 * INTERVIEW-GUIDE.md, was meant to surface real drafting tolerance
 * expectations from architects) and depend on ADR-0004's still-open
 * canonical-unit choice (D-014, docs/product/DECISION-REGISTER.csv).
 * What this module actually delivers - and what ARQ-081 is really
 * asking for - is the *policy*: named fields instead of scattered magic
 * numbers, and tolerant-equality functions that take their tolerance as
 * an explicit, required parameter (never a hidden default), so a caller
 * can never accidentally compare two coordinates with an
 * un-auditable, ad hoc epsilon.
 */

export interface ToleranceContext {
  readonly coordinateEpsilon: number;
  readonly angularEpsilon: number;
  readonly coincidentPointTolerance: number;
  readonly minimumWallLength: number;
  readonly minimumOpeningClearance: number;
  readonly roomClosureTolerance: number;
  readonly snapScreenTolerance: number;
}

/** Provisional defaults - see this module's doc comment. */
export const DEFAULT_TOLERANCES: ToleranceContext = {
  coordinateEpsilon: 1e-9,
  angularEpsilon: 1e-9,
  coincidentPointTolerance: 1e-6,
  minimumWallLength: 1e-3,
  minimumOpeningClearance: 1e-3,
  roomClosureTolerance: 1e-3,
  snapScreenTolerance: 6,
};

/** Exact equality - explicitly named as such, so a reader never has to guess whether "equal" means "tolerant" here. */
export function numbersAreExactlyEqual(a: number, b: number): boolean {
  return a === b;
}

/** Tolerant equality - `tolerance` is required, not defaulted, so every call site names which of ToleranceContext's fields it means. */
export function numbersAreWithinTolerance(a: number, b: number, tolerance: number): boolean {
  if (!Number.isFinite(a) || !Number.isFinite(b) || !Number.isFinite(tolerance) || tolerance < 0) {
    return false;
  }
  return Math.abs(a - b) <= tolerance;
}

export function pointsAreCoincident(
  a: { readonly x: number; readonly y: number },
  b: { readonly x: number; readonly y: number },
  tolerance: number,
): boolean {
  if (!Number.isFinite(tolerance) || tolerance < 0) {
    return false;
  }
  const distance = Math.hypot(a.x - b.x, a.y - b.y);
  return Number.isFinite(distance) && distance <= tolerance;
}

/** Compares two angles (radians) accounting for wraparound (e.g. -pi and pi are the same direction). */
export function anglesAreWithinTolerance(a: number, b: number, tolerance: number): boolean {
  if (!Number.isFinite(a) || !Number.isFinite(b) || !Number.isFinite(tolerance) || tolerance < 0) {
    return false;
  }
  const twoPi = Math.PI * 2;
  const rawDiff = Math.abs(a - b) % twoPi;
  const diff = Math.min(rawDiff, twoPi - rawDiff);
  return diff <= tolerance;
}
