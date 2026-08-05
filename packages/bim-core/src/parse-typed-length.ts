import { length, type Length, type LengthUnit } from './length';

/**
 * V3-100: parse typed length text into a typed `Length`.
 *
 * `parseMetricLength` and `parseImperialLength` (ARQ-054/055) both return a
 * plain number of millimetres, and both say in their own doc comments that the
 * millimetre output is their internal contract rather than a resolved decision
 * about what unit anything is stored in. That is fine for the numeric overlay,
 * which needs a distance and nothing else. It is not enough anywhere the value
 * survives the gesture, because the unit the user typed is information, and
 * converting it away at the parser destroys it: someone who types `3m` and sees
 * `3000` back has been told their input was wrong when it was not.
 *
 * So this keeps the unit. `3m` parses to a Length of 3 metres, not 3000
 * millimetres, and a surface that echoes it back shows what was typed.
 * Conversion is `convertLength`'s job, at the point something actually needs a
 * common unit, which is a different moment and often never.
 *
 * `defaultUnit` is a required parameter rather than a default. A bare `3` means
 * 3mm in a metric project and 3 inches nowhere sensible in an imperial one, and
 * a parser that picks for itself is how a dimension ends up three hundred times
 * wrong with nothing anywhere reporting a problem. The caller knows the
 * project's unit; this does not, and does not guess.
 */

export type TypedLengthRejection =
  'empty' | 'malformed' | 'negative' | 'not-finite' | 'unknown-unit' | 'zero-denominator';

export type ParseTypedLengthOutcome =
  | { readonly status: 'parsed'; readonly length: Length }
  | { readonly status: 'rejected'; readonly reason: TypedLengthRejection };

const SUFFIXED = /^(\d+(?:\.\d+)?)\s*([a-z"']+)$/i;
const BARE = /^(\d+(?:\.\d+)?)$/;
/** `10'`, `10' 6"`, `10'6"`, `10' 6 1/2"`, or a bare `6"`. */
const FEET_INCHES = /^(?:(\d+(?:\.\d+)?)')?\s*(?:(\d+(?:\.\d+)?)(?:\s+(\d+)\/(\d+))?")?$/;

const UNIT_ALIASES: Readonly<Record<string, LengthUnit>> = {
  mm: 'mm',
  cm: 'cm',
  m: 'm',
  in: 'in',
  ft: 'ft',
};

/**
 * Parses length text.
 *
 * Negative input is rejected rather than accepted and flagged, matching both
 * existing parsers and the numeric overlay's distance field. A negative
 * distance in a drawing gesture has no agreed meaning - it is not "the other
 * direction", because direction is already carried by the angle - and inventing
 * one here would put a sign into the model that nothing downstream reads.
 */
export function parseTypedLength(text: string, defaultUnit: LengthUnit): ParseTypedLengthOutcome {
  const trimmed = text.trim();
  if (trimmed === '') {
    return { status: 'rejected', reason: 'empty' };
  }
  if (trimmed.startsWith('-')) {
    return { status: 'rejected', reason: 'negative' };
  }

  const bare = BARE.exec(trimmed);
  if (bare) {
    return finiteLength(Number(bare[1]), defaultUnit);
  }

  // Feet-and-inches is checked before the plain suffix form, because `10'6"`
  // has two units in one token and the suffix pattern would read it as one.
  if (trimmed.includes("'") || trimmed.includes('"')) {
    return parseFeetInches(trimmed);
  }

  const suffixed = SUFFIXED.exec(trimmed);
  if (!suffixed) {
    return { status: 'rejected', reason: 'malformed' };
  }

  const unit = UNIT_ALIASES[(suffixed[2] ?? '').toLowerCase()];
  if (unit === undefined) {
    return { status: 'rejected', reason: 'unknown-unit' };
  }

  return finiteLength(Number(suffixed[1]), unit);
}

/**
 * Feet-and-inches parses to a Length in feet, since that is the unit the
 * notation is written in - `10' 6"` is ten and a half feet, and expressing it
 * as 126 inches would be as much of a rewrite as expressing it in millimetres.
 */
function parseFeetInches(trimmed: string): ParseTypedLengthOutcome {
  const match = FEET_INCHES.exec(trimmed);
  if (!match) {
    return { status: 'rejected', reason: 'malformed' };
  }

  const [, feetText, inchesText, numeratorText, denominatorText] = match;
  if (feetText === undefined && inchesText === undefined) {
    return { status: 'rejected', reason: 'malformed' };
  }

  const feet = feetText === undefined ? 0 : Number(feetText);
  let inches = inchesText === undefined ? 0 : Number(inchesText);

  if (numeratorText !== undefined && denominatorText !== undefined) {
    const denominator = Number(denominatorText);
    if (denominator === 0) {
      return { status: 'rejected', reason: 'zero-denominator' };
    }
    inches += Number(numeratorText) / denominator;
  }

  return finiteLength(feet + inches / 12, 'ft');
}

function finiteLength(value: number, unit: LengthUnit): ParseTypedLengthOutcome {
  if (!Number.isFinite(value)) {
    return { status: 'rejected', reason: 'not-finite' };
  }
  return { status: 'parsed', length: length(value, unit) };
}

/**
 * Whole text that could still become a valid length as the user keeps typing.
 *
 * The parser answers "is this a length"; this answers "could this be one yet",
 * and a field needs both. Rejecting a keystroke because the value is not
 * complete makes it impossible to type `3m` at all - `3m` passes through `3`,
 * which parses, and a caller that only had the parser would have to accept or
 * reject on every character.
 */
export function isPartialTypedLength(text: string): boolean {
  const trimmed = text.trim();
  if (trimmed === '') {
    return true;
  }

  if (trimmed.includes("'") || trimmed.includes('"')) {
    return PARTIAL_FEET_INCHES.test(trimmed);
  }

  const partial = PARTIAL_SUFFIXED.exec(trimmed);
  if (!partial) {
    return false;
  }
  // Checked against the prefixes of the units that exist rather than "up to two
  // letters", which would accept `km` all the way to the point of rejection and
  // let a user type a whole unit Arq does not have.
  return UNIT_PREFIXES.has((partial[2] ?? '').toLowerCase());
}

const PARTIAL_SUFFIXED = /^(\d*\.?\d*)\s*([a-z]*)$/i;
const PARTIAL_FEET_INCHES = /^(?:\d*\.?\d*')?\s*(?:\d*\.?\d*(?:\s+\d*(?:\/\d*)?)?"?)?$/;

/** Every prefix of every known unit, including the empty one. */
const UNIT_PREFIXES: ReadonlySet<string> = new Set(
  Object.keys(UNIT_ALIASES).flatMap((unit) =>
    Array.from({ length: unit.length + 1 }, (_, index) => unit.slice(0, index)),
  ),
);

/**
 * Formats a Length back as text a user would recognise.
 *
 * Feet render in feet-and-inches notation rather than as a decimal, because
 * `10' 6"` is how the value was typed and how a drawing prints it; `10.5 ft`
 * would be a correct number in a form nobody in the trade writes.
 */
export function formatTypedLength(value: Length, fractionDenominator = 16): string {
  if (value.unit !== 'ft') {
    return `${trimNumber(value.value)}${value.unit}`;
  }

  const totalInches = value.value * 12;
  const feet = Math.floor(totalInches / 12);
  const remainingInches = totalInches - feet * 12;
  const wholeInches = Math.floor(remainingInches);
  const fractionUnits = Math.round((remainingInches - wholeInches) * fractionDenominator);

  if (fractionUnits === 0) {
    return wholeInches === 0 ? `${feet}'` : `${feet}' ${wholeInches}"`;
  }
  if (fractionUnits === fractionDenominator) {
    return `${feet}' ${wholeInches + 1}"`;
  }

  const divisor = greatestCommonDivisor(fractionUnits, fractionDenominator);
  return `${feet}' ${wholeInches} ${fractionUnits / divisor}/${fractionDenominator / divisor}"`;
}

function trimNumber(value: number): string {
  return Number.isInteger(value) ? String(value) : String(Number(value.toFixed(4)));
}

function greatestCommonDivisor(a: number, b: number): number {
  return b === 0 ? a : greatestCommonDivisor(b, a % b);
}
