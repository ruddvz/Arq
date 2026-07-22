/**
 * ARQ-055: support imperial numeric input.
 *
 * Parses feet-and-inches text typed into the numeric overlay (ARQ-053) -
 * e.g. `10'`, `6"`, `10' 6"`, `10'6"`, or with a fractional inch,
 * `10' 6 1/2"` - into millimetres, on the same "this parser's own
 * numeric-output contract, not a resolved ADR-0004 decision" basis as
 * metric-numeric-input.ts (ARQ-054).
 *
 * A negative length is rejected (returns null), same as the metric
 * parser and the numeric overlay's distance field - which also sidesteps
 * the ambiguity of what a negative sign would mean once split across a
 * feet part and an inches part (`-10' 6"` could plausibly mean either
 * -10.5' or -10' + 6"; rejecting negative avoids having to guess).
 */

const FEET_PATTERN = /^(\d+(?:\.\d+)?)'\s*/;
const INCHES_PATTERN = /^(\d+(?:\.\d+)?)(?:\s+(\d+)\/(\d+))?"$/;

const MM_PER_INCH = 25.4;
const INCHES_PER_FOOT = 12;

/** Parses feet/inches text into millimetres, or null if empty, malformed, or negative. */
export function parseImperialLength(text: string): number | null {
  const trimmed = text.trim();
  if (trimmed === '') {
    return null;
  }

  let rest = trimmed;
  let feet = 0;
  let hasFeet = false;
  const feetMatch = FEET_PATTERN.exec(rest);
  if (feetMatch) {
    feet = Number(feetMatch[1]);
    hasFeet = true;
    rest = rest.slice(feetMatch[0].length);
  }

  let inches = 0;
  let hasInches = false;
  if (rest !== '') {
    const inchMatch = INCHES_PATTERN.exec(rest);
    if (!inchMatch) {
      return null;
    }
    inches = Number(inchMatch[1]);
    hasInches = true;
    if (inchMatch[2] !== undefined && inchMatch[3] !== undefined) {
      const denominator = Number(inchMatch[3]);
      if (denominator === 0) {
        return null;
      }
      inches += Number(inchMatch[2]) / denominator;
    }
  }

  if (!hasFeet && !hasInches) {
    return null;
  }
  if (!Number.isFinite(feet) || !Number.isFinite(inches)) {
    return null;
  }

  const totalInches = feet * INCHES_PER_FOOT + inches;
  return totalInches * MM_PER_INCH;
}
