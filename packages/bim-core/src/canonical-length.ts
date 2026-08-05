import type { Brand } from './ids';

/**
 * V3-109/V3-110: the canonical persisted length unit, as a checked type.
 *
 * `length.ts` deliberately says nothing about what Arq *stores* - it converts
 * between display units and uses millimetres as an arithmetic pivot, and its own
 * comment records that the canonical unit is an open decision. This module is
 * the candidate for that decision, kept separate so the two can coexist while it
 * is still Proposed: display conversion is not persistence, and merging them
 * would make an unaccepted decision look settled.
 *
 * The candidate is signed integer micrometres. The reason is determinism rather
 * than precision. Architectural work is full of operations that must round-trip
 * exactly - move a wall and move it back, export and reimport, replay an
 * operation log, hash a project on two machines and compare. Float64
 * millimetres round-trip *almost* exactly, and "almost" is the problem: two
 * projects that are semantically identical hash differently, an equality test
 * needs an epsilon, and the epsilon has to be chosen per call site by whoever
 * happens to be writing that line.
 *
 * ## Why `number` and not `bigint`
 *
 * The ARQ File System 3.0 draft assumed 64-bit micrometres would need `bigint`
 * in TypeScript, and treated that as the main cost of the decision. Measured,
 * it does not: `Number.MAX_SAFE_INTEGER` is about 9.007e15, so a plain double
 * represents every integer micrometre up to roughly 9.007e9 metres - nine
 * million kilometres. Every architectural extent, plus every intermediate value
 * an architectural computation produces, fits with orders of magnitude to
 * spare. `bigint` would buy range nothing needs, in exchange for slower
 * arithmetic, no arithmetic operators mixing with float geometry, and a
 * serialisation problem at every Worker and JSON boundary.
 *
 * So the canonical value is a `number` that is *required to be an integer* and
 * required to stay inside a declared project extent - both checked at the
 * boundary rather than assumed. `scripts/run-canonical-units-spike.mjs` is the
 * measurement behind those claims.
 */

/** A length in whole micrometres. Branded so a raw number cannot be mistaken for one. */
export type CanonicalLength = Brand<number, 'CanonicalLength'>;

export const MICROMETRES_PER_MILLIMETRE = 1_000;
export const MICROMETRES_PER_METRE = 1_000_000;

/**
 * The largest coordinate magnitude a project may hold: 100 km in micrometres.
 *
 * Chosen for headroom rather than ambition. It is far beyond any site, and
 * still leaves roughly five orders of magnitude below `MAX_SAFE_INTEGER`, so
 * intermediate values in a computation - a squared distance, a sum along a long
 * polyline - do not silently leave the exactly-representable range before
 * anything checks them. A limit set at the representable maximum would be exact
 * for stored values and unsafe for everything computed from them.
 */
export const MAX_PROJECT_EXTENT_MICROMETRES = 100_000 * MICROMETRES_PER_METRE;

export type CanonicalLengthRejection = 'not-finite' | 'not-an-integer' | 'outside-project-extent';

export type CanonicalLengthResult =
  | { readonly status: 'ok'; readonly value: CanonicalLength }
  | {
      readonly status: 'rejected';
      readonly reason: CanonicalLengthRejection;
      readonly detail: string;
    };

/**
 * Accepts a value that is already whole micrometres.
 *
 * Rejects rather than rounds. A caller holding a fractional micrometre has a
 * unit or precision bug, and quietly rounding it would hide the bug while
 * producing a value that no longer equals what the caller believes it stored.
 * Callers converting from a continuous quantity should use `quantise`, which
 * rounds because rounding is what it is for.
 */
export function canonicalLength(micrometres: number): CanonicalLengthResult {
  if (!Number.isFinite(micrometres)) {
    return { status: 'rejected', reason: 'not-finite', detail: String(micrometres) };
  }
  if (!Number.isInteger(micrometres)) {
    return {
      status: 'rejected',
      reason: 'not-an-integer',
      detail: `${micrometres} is not a whole number of micrometres`,
    };
  }
  if (Math.abs(micrometres) > MAX_PROJECT_EXTENT_MICROMETRES) {
    return {
      status: 'rejected',
      reason: 'outside-project-extent',
      detail: `${micrometres}µm exceeds the ±${MAX_PROJECT_EXTENT_MICROMETRES}µm project extent`,
    };
  }
  return { status: 'ok', value: micrometres as CanonicalLength };
}

/**
 * Converts a continuous measurement into the canonical grid.
 *
 * This is the one place rounding is correct, and the reason the boundary exists:
 * geometry, import and the renderer all work in floats, and a float has to
 * become exact somewhere before it is committed. Doing it here, once, means
 * every stored value is on the grid - which is what makes canonical equality
 * exact rather than epsilon-based everywhere downstream.
 */
export function quantiseMillimetres(millimetres: number): CanonicalLengthResult {
  if (!Number.isFinite(millimetres)) {
    return { status: 'rejected', reason: 'not-finite', detail: String(millimetres) };
  }
  return canonicalLength(Math.round(millimetres * MICROMETRES_PER_MILLIMETRE));
}

export function quantiseMetres(metres: number): CanonicalLengthResult {
  if (!Number.isFinite(metres)) {
    return { status: 'rejected', reason: 'not-finite', detail: String(metres) };
  }
  return canonicalLength(Math.round(metres * MICROMETRES_PER_METRE));
}

/** Exact, because both operands are on the grid. No epsilon, and none needed. */
export function canonicalLengthsAreEqual(a: CanonicalLength, b: CanonicalLength): boolean {
  return a === b;
}

/** For display and for handing to float geometry. Lossy by design, and never stored back without re-quantising. */
export function canonicalToMillimetres(value: CanonicalLength): number {
  return value / MICROMETRES_PER_MILLIMETRE;
}

export function canonicalToMetres(value: CanonicalLength): number {
  return value / MICROMETRES_PER_METRE;
}

/**
 * Adds canonical lengths, re-checking the extent.
 *
 * Sums are checked rather than assumed because the extent limit is about the
 * project, not about each input: two in-range coordinates can add to something
 * outside it, and an unchecked sum is how a value leaves the range that every
 * later exactness guarantee depends on.
 */
export function addCanonicalLengths(a: CanonicalLength, b: CanonicalLength): CanonicalLengthResult {
  return canonicalLength(a + b);
}

export function subtractCanonicalLengths(
  a: CanonicalLength,
  b: CanonicalLength,
): CanonicalLengthResult {
  return canonicalLength(a - b);
}

/**
 * Scales a canonical length, quantising the result.
 *
 * Scaling is where exactness genuinely cannot be preserved - a third of a
 * micrometre does not exist on the grid - so the result is rounded back onto it
 * and the caller is told nothing was lost only when nothing was.
 */
export function scaleCanonicalLength(
  value: CanonicalLength,
  factor: number,
): CanonicalLengthResult {
  if (!Number.isFinite(factor)) {
    return { status: 'rejected', reason: 'not-finite', detail: String(factor) };
  }
  return canonicalLength(Math.round(value * factor));
}

/** Convenience for call sites that have already proven the value is valid. Throws rather than returning a wrong number. */
export function expectCanonicalLength(result: CanonicalLengthResult): CanonicalLength {
  if (result.status !== 'ok') {
    throw new Error(`invalid canonical length: ${result.reason} (${result.detail})`);
  }
  return result.value;
}
