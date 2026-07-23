/**
 * ARQ-144: implement scale validation.
 *
 * Blueprint section 59 ("PDF export")'s "PDF regression" checklist
 * names a "printed scale test" as one of its required checks - that an
 * exported sheet's linework actually prints at the physical size its
 * declared architectural scale (e.g. "1:100") promises, not merely
 * whatever ratio a viewport's `scale` number happens to hold. This
 * module turns that manual "measure it with a ruler" regression check
 * into a pure, testable calculation.
 *
 * `ArchitecturalScale` models the familiar "1:N" notation directly
 * (`modelUnitsPerPaperUnit: 100` for "1:100" - 100 model units drawn as
 * one paper unit), rather than exposing the raw viewport-scale ratio
 * (paper points per world unit, sheet-viewport.ts/ARQ-141's
 * `SheetViewportTransform.scale`) as the thing a caller specifies -
 * nobody names a drawing's scale as "0.0283...", they name it "1:100".
 *
 * Millimetres, not points, are this module's own input/output unit for
 * world-space lengths (`printedLengthMm`'s `worldLengthMm` parameter
 * and `POINTS_PER_MM`'s conversion), matching the same provisional
 * mm-per-world-unit stance room-area.ts (ARQ-114) and linear-
 * dimension.ts (ARQ-137) already take - ADR-0004/D-014 (canonical unit
 * representation) is still undecided, and nothing here resolves it.
 *
 * Deliberately decoupled from `SheetViewportTransform`: scale
 * correctness is translation-invariant (a viewport's `position` never
 * affects whether its `scale` matches a claimed "1:100"), so this
 * module works with a plain `viewportScale` ratio rather than
 * importing the whole transform shape, keeping it usable anywhere a
 * caller already has that one number.
 */

const POINTS_PER_MM = 72 / 25.4;

export interface ArchitecturalScale {
  /** The "N" in "1:N" - how many model units one paper unit represents. Must be positive and finite. */
  readonly modelUnitsPerPaperUnit: number;
}

/** Converts an architectural scale (e.g. "1:100") into the viewport-scale ratio (PDF points per world-space millimetre) that scale implies. */
export function architecturalScaleToViewportScale(scale: ArchitecturalScale): number {
  if (!Number.isFinite(scale.modelUnitsPerPaperUnit) || scale.modelUnitsPerPaperUnit <= 0) {
    throw new RangeError('modelUnitsPerPaperUnit must be a positive finite number');
  }
  return POINTS_PER_MM / scale.modelUnitsPerPaperUnit;
}

/** Section 59's "printed scale test": true when `viewportScale` (points per world-space mm) matches the ratio `scale` (e.g. "1:100") implies, within `toleranceRatio` of the expected value. */
export function viewportScaleMatchesArchitecturalScale(
  viewportScale: number,
  scale: ArchitecturalScale,
  toleranceRatio = 1e-9,
): boolean {
  const expected = architecturalScaleToViewportScale(scale);
  return Math.abs(viewportScale - expected) <= toleranceRatio * expected;
}

/** The real, printed physical length (millimetres) a `worldLengthMm`-long piece of model geometry prints at under a viewport whose scale ratio is `viewportScale` - the quantity a ruler against the printed sheet actually measures. */
export function printedLengthMm(worldLengthMm: number, viewportScale: number): number {
  return (worldLengthMm * viewportScale) / POINTS_PER_MM;
}
