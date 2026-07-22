/**
 * ARQ-059: define typed unit library.
 *
 * A unit-tagged length value plus conversion between the five units the
 * numeric overlay already accepts (mm, cm, m from ARQ-054; in, ft from
 * ARQ-055's feet/inches parsing, expressed here as plain inches/feet
 * rather than the "10' 6\"" text format that parser handles).
 *
 * Millimetres is used internally as this module's conversion pivot
 * purely because it is the smallest unit in the table (so every
 * conversion factor is a whole or simple decimal number) - this is an
 * implementation detail of the conversion arithmetic, not a claim about
 * which unit the application eventually stores geometry in. That is
 * ADR-0004 / D-014 (docs/product/DECISION-REGISTER.csv), still an open
 * decision; nothing here resolves it.
 */

export type LengthUnit = 'mm' | 'cm' | 'm' | 'in' | 'ft';

export interface Length {
  readonly value: number;
  readonly unit: LengthUnit;
}

const MM_PER_UNIT: Readonly<Record<LengthUnit, number>> = {
  mm: 1,
  cm: 10,
  m: 1000,
  in: 25.4,
  ft: 304.8,
};

export function length(value: number, unit: LengthUnit): Length {
  return { value, unit };
}

export function toMillimetres(input: Length): number {
  return input.value * MM_PER_UNIT[input.unit];
}

export function convertLength(input: Length, targetUnit: LengthUnit): Length {
  return { value: toMillimetres(input) / MM_PER_UNIT[targetUnit], unit: targetUnit };
}

/** Adds two lengths of possibly different units; the result is expressed in `a`'s unit. */
export function addLengths(a: Length, b: Length): Length {
  return { value: a.value + toMillimetres(b) / MM_PER_UNIT[a.unit], unit: a.unit };
}

/** True if both lengths represent the same physical length, regardless of unit, within `toleranceMm`. */
export function lengthsAreEqual(a: Length, b: Length, toleranceMm = 1e-9): boolean {
  return Math.abs(toMillimetres(a) - toMillimetres(b)) <= toleranceMm;
}
