/**
 * ARQ-158: exchange: prototype DXF parser.
 *
 * Maps the HEADER section's `$INSUNITS` variable (a DXF-standard integer
 * code) to a unit name, per DXF-PLAN.md's "units" Stage 1 requirement.
 * Only the units real architectural drawings actually use are named;
 * every other DXF-standard code (there are many rarely-used ones, e.g.
 * astronomical units) collapses to 'unspecified' rather than this
 * prototype inventing a name for units no drawing here will realistically
 * carry.
 */

export type DxfUnits =
  'unitless' | 'inches' | 'feet' | 'millimeters' | 'centimeters' | 'meters' | 'unspecified';

const INSUNITS_CODE_TO_UNITS: Readonly<Record<number, DxfUnits>> = {
  0: 'unitless',
  1: 'inches',
  2: 'feet',
  4: 'millimeters',
  5: 'centimeters',
  6: 'meters',
};

/** Resolves a parsed `$INSUNITS` integer code to a unit name; an unrecognized or missing code resolves to 'unspecified' rather than throwing. */
export function resolveDxfUnits(insunitsCode: number | undefined): DxfUnits {
  if (insunitsCode === undefined) {
    return 'unspecified';
  }
  return INSUNITS_CODE_TO_UNITS[insunitsCode] ?? 'unspecified';
}
