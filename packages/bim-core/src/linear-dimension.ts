/**
 * ARQ-137: implement linear dimension.
 *
 * The entity half of blueprint section 55 ("Dimensions")'s linear
 * dimension, built on ARQ-136's DimensionReference (the schema half).
 * Properties modelled directly from section 55's list: witness lines
 * (start/end, both DimensionReferences), offset, text position is left
 * to the renderer (a display concern, not model data - matching
 * plan-scene.ts's own renderer/model split), style is deferred to
 * plan-renderer's existing StyleToken (ARQ-119) rather than duplicated
 * here, precision, prefix and suffix, and textOverride ("override,
 * visibly marked").
 *
 * Section 55's Rules, and how each is upheld:
 *
 * - "dimensions reference semantic subentities" - start/end are
 *   DimensionReferences, never raw coordinates (explicit-point is the
 *   one exception the blueprint itself names).
 * - "detached references show warning" - linearDimensionIsDetached
 *   reuses ARQ-136's dimensionReferenceIsDetached for both witness
 *   lines.
 * - "geometry change updates value" - measuredLinearDimensionLength
 *   takes the two witness lines' *current* resolved WorldPoints as
 *   parameters and always recomputes from them; LinearDimension itself
 *   stores no cached length, so there is nothing here that could go
 *   stale.
 * - "text override never changes measured value" - upheld by
 *   construction: measuredLinearDimensionLength never reads
 *   textOverride at all, and linearDimensionDisplayText (the only
 *   function that does read it) never feeds back into the measured
 *   value.
 * - "numerical display follows project units" - measuredLinearDimensionLength
 *   returns bim-core's unit-tagged Length (ARQ-059); a caller converts
 *   to whichever unit the project's display settings specify via
 *   convertLength, the same pattern resolveWallHeight already
 *   establishes.
 *
 * Resolving a DimensionReference to an actual WorldPoint (walking a
 * wall's outline, an opening's host wall, etc.) is deliberately not
 * this module's job - that resolution needs @arq/geometry-2d's wall/
 * opening geometry helpers together with the project's live element
 * data, which would couple this schema-and-measurement module to a
 * much larger surface. Callers resolve references themselves (they
 * already have the project state to do so) and pass this module only
 * the resulting WorldPoints.
 *
 * World-space distances are treated as millimetres for the Length
 * conversion, the same provisional stance room-area.ts (ARQ-114)
 * already takes - ADR-0004/D-014 (canonical unit representation) is
 * still undecided, and nothing here resolves it.
 */

import { vectorBetween, vectorLength, type WorldPoint } from '@arq/geometry-2d';
import { length, type Length } from './length';
import type { DimensionId, ElementId, LevelId } from './ids';
import { dimensionReferenceIsDetached, type DimensionReference } from './dimension-reference';

export interface LinearDimension {
  readonly id: DimensionId;
  readonly levelId: LevelId;
  readonly start: DimensionReference;
  readonly end: DimensionReference;
  /** Witness line offset distance from the referenced geometry to the dimension line. */
  readonly offset: Length;
  /** Number of decimal places shown in the formatted value. */
  readonly precision: number;
  readonly prefix?: string;
  readonly suffix?: string;
  /** "Override, visibly marked" (section 55) - never affects measuredLinearDimensionLength. */
  readonly textOverride?: string;
}

export interface CreateLinearDimensionInput {
  readonly id: DimensionId;
  readonly levelId: LevelId;
  readonly start: DimensionReference;
  readonly end: DimensionReference;
  readonly offset: Length;
  readonly precision?: number;
  readonly prefix?: string;
  readonly suffix?: string;
  readonly textOverride?: string;
}

export function createLinearDimension(input: CreateLinearDimensionInput): LinearDimension {
  const dimension: LinearDimension = {
    id: input.id,
    levelId: input.levelId,
    start: input.start,
    end: input.end,
    offset: input.offset,
    precision: input.precision ?? 0,
  };
  return {
    ...dimension,
    ...(input.prefix === undefined ? {} : { prefix: input.prefix }),
    ...(input.suffix === undefined ? {} : { suffix: input.suffix }),
    ...(input.textOverride === undefined ? {} : { textOverride: input.textOverride }),
  };
}

/** The dimension's actual measured length between its two resolved endpoints - never affected by textOverride. See this module's doc comment for the mm-per-world-unit provisional stance. */
export function measuredLinearDimensionLength(startPoint: WorldPoint, endPoint: WorldPoint): Length {
  return length(vectorLength(vectorBetween(startPoint, endPoint)), 'mm');
}

/** Section 55's "detached references show warning": true when either witness line's referenced element no longer exists. */
export function linearDimensionIsDetached(
  dimension: LinearDimension,
  existingElementIds: ReadonlySet<ElementId>,
): boolean {
  return (
    dimensionReferenceIsDetached(dimension.start, existingElementIds) ||
    dimensionReferenceIsDetached(dimension.end, existingElementIds)
  );
}

/**
 * The text an inspector/renderer shows: `textOverride` verbatim when
 * set (the override is "visibly marked" by the caller, not by this
 * function - marking is a display concern), otherwise
 * prefix + the measured value formatted to `precision` decimal places + suffix.
 */
export function linearDimensionDisplayText(
  dimension: LinearDimension,
  measured: Length,
): string {
  if (dimension.textOverride !== undefined) {
    return dimension.textOverride;
  }
  const prefix = dimension.prefix ?? '';
  const suffix = dimension.suffix ?? '';
  return `${prefix}${measured.value.toFixed(dimension.precision)}${suffix}`;
}
