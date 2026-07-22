/**
 * ARQ-054: support metric numeric input.
 *
 * Parses a length typed into the numeric overlay (ARQ-053) as metric text
 * - a plain number, optionally suffixed with mm/cm/m (case-insensitive,
 * optional whitespace before the suffix) - into millimetres. Millimetres
 * is this parser's own internal contract for its numeric output, not a
 * claim that ADR-0004 (units and numeric representation, still "Research
 * required") has been decided; a caller converts to whatever the eventual
 * canonical unit turns out to be.
 *
 * No suffix defaults to millimetres, matching this module's own numeric
 * output unit - a documented convention, not a resolved product decision
 * about what unit end users should be assumed to be typing in.
 *
 * A negative length is rejected (returns null), consistent with the
 * numeric overlay's distance field.
 */

export type MetricUnit = 'mm' | 'cm' | 'm';

const METRIC_UNIT_TO_MM: Readonly<Record<MetricUnit, number>> = { mm: 1, cm: 10, m: 1000 };

const METRIC_LENGTH_PATTERN = /^(\d+(?:\.\d+)?)\s*(mm|cm|m)?$/i;

/** Parses metric length text into millimetres, or null if the text is empty, malformed, or negative. */
export function parseMetricLength(text: string): number | null {
  const trimmed = text.trim();
  const match = METRIC_LENGTH_PATTERN.exec(trimmed);
  if (!match) {
    return null;
  }
  const value = Number(match[1]);
  if (!Number.isFinite(value)) {
    return null;
  }
  const unit = (match[2]?.toLowerCase() ?? 'mm') as MetricUnit;
  return value * METRIC_UNIT_TO_MM[unit];
}
