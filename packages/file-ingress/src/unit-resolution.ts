/**
 * V3-176: an import whose units are unknown is refused, not guessed.
 *
 * `resolveDxfUnits` maps `$INSUNITS` and returns `'unspecified'` for anything it
 * does not recognise, which is the right answer to "what does this code mean".
 * It is not an answer to "what do I do now", and the answer everything reaches
 * for by default - assume millimetres - is how a ten metre wall arrives as ten
 * millimetres. The drawing opens, nothing errors, and the mistake is found when
 * something is built.
 *
 * The mistake is also not recoverable after the fact by inspection. A plan
 * whose walls are 10,000 units long is a 10m building in millimetres and a 10km
 * site in metres, and both are things people draw. Scale is the one property an
 * importer cannot infer from the geometry, because the geometry looks identical
 * either way.
 *
 * So an unresolved unit is a state, not an error and not a default. The import
 * continues far enough to describe what was found, the source file is preserved
 * whatever happens, and every length-bearing conversion waits for someone to
 * say which unit was meant. `unitScaleFactor` refuses to compute a factor for
 * an unresolved unit rather than returning 1, because a factor of 1 is a claim
 * that the file was already in Arq's unit.
 */

export type ImportUnit = 'mm' | 'cm' | 'm' | 'in' | 'ft';

/** Where a resolved unit came from. Recorded because a user's answer and a file's declaration carry different weight in a later dispute. */
export type UnitSource = 'declared' | 'user' | 'policy-default';

export type UnitResolution =
  | { readonly status: 'resolved'; readonly unit: ImportUnit; readonly source: UnitSource }
  | {
      readonly status: 'unresolved';
      readonly reason: 'undeclared' | 'unitless' | 'unrecognised';
      readonly detail: string;
      /** What the file said, verbatim, so a prompt can show it. */
      readonly declaredValue?: string;
    };

const DECLARED_TO_UNIT: Readonly<Record<string, ImportUnit>> = {
  millimeters: 'mm',
  millimetres: 'mm',
  mm: 'mm',
  centimeters: 'cm',
  centimetres: 'cm',
  cm: 'cm',
  meters: 'm',
  metres: 'm',
  m: 'm',
  inches: 'in',
  inch: 'in',
  in: 'in',
  feet: 'ft',
  foot: 'ft',
  ft: 'ft',
};

/**
 * Resolves the unit an import should be read in.
 *
 * `unitless` is treated as unresolved rather than as a unit. A DXF that says
 * "unitless" has told you it has no scale, and reading that as "so use the
 * default" converts a statement of ignorance into a measurement.
 */
export function resolveImportUnits(declared: string | undefined): UnitResolution {
  if (declared === undefined || declared.trim().length === 0) {
    return {
      status: 'unresolved',
      reason: 'undeclared',
      detail: 'the file declares no drawing unit',
    };
  }

  const normalised = declared.trim().toLowerCase();

  if (normalised === 'unitless' || normalised === 'unspecified') {
    return {
      status: 'unresolved',
      reason: 'unitless',
      detail: 'the file states that it has no drawing unit',
      declaredValue: declared,
    };
  }

  const unit = DECLARED_TO_UNIT[normalised];
  if (unit === undefined) {
    return {
      status: 'unresolved',
      reason: 'unrecognised',
      detail: `"${declared}" is not a unit this importer reads`,
      declaredValue: declared,
    };
  }

  return { status: 'resolved', unit, source: 'declared' };
}

/**
 * Records the unit a person chose.
 *
 * Separate from `resolveImportUnits` because the two carry different weight: a
 * declared unit is what the file said, and a chosen unit is what somebody
 * decided it meant. Both convert the same way, and only one of them is
 * evidence.
 */
export function resolveWithUserChoice(unit: ImportUnit): UnitResolution {
  return { status: 'resolved', unit, source: 'user' };
}

const MM_PER_UNIT: Readonly<Record<ImportUnit, number>> = {
  mm: 1,
  cm: 10,
  m: 1000,
  in: 25.4,
  ft: 304.8,
};

/**
 * Millimetres per source unit, or null when the unit is unresolved.
 *
 * Null rather than 1. A factor of 1 is a claim that the file was already in
 * millimetres, which is exactly the guess this module exists to prevent, and it
 * would be indistinguishable at every call site from a genuine millimetre file.
 */
export function unitScaleFactor(resolution: UnitResolution): number | null {
  return resolution.status === 'resolved' ? MM_PER_UNIT[resolution.unit] : null;
}

/** Whether anything carrying a length may be converted yet. */
export function canConvertLengths(resolution: UnitResolution): boolean {
  return resolution.status === 'resolved';
}

/**
 * What an import may still do while its unit is unresolved.
 *
 * Not "nothing". The source file is preserved regardless - that is what makes
 * the decision recoverable later - and everything scale-free is still real:
 * layer names, block names, text content, entity counts, the fact that the file
 * parsed at all. Reporting those is how a user is given enough to answer the
 * question, rather than a dialog that asks for a unit with no context.
 */
export interface UnresolvedUnitCapabilities {
  readonly preserveSource: true;
  readonly reportStructure: true;
  readonly convertGeometry: false;
  readonly stageElements: false;
}

export const UNRESOLVED_UNIT_CAPABILITIES: UnresolvedUnitCapabilities = {
  preserveSource: true,
  reportStructure: true,
  convertGeometry: false,
  stageElements: false,
};

/** The units a prompt should offer, most likely first for an architectural drawing. */
export const OFFERED_IMPORT_UNITS: readonly ImportUnit[] = ['mm', 'm', 'cm', 'ft', 'in'];

/**
 * A sentence explaining why the import is waiting.
 *
 * Written here so every surface says the same thing, and phrased as a fact
 * about the file rather than as a failure of the import. "This drawing does not
 * say what its units are" is true and actionable; "import failed" is neither.
 */
export function describeUnresolvedUnits(resolution: UnitResolution): string | null {
  if (resolution.status === 'resolved') {
    return null;
  }
  switch (resolution.reason) {
    case 'undeclared':
      return 'This drawing does not say what its units are. Choose the unit it was drawn in.';
    case 'unitless':
      return 'This drawing states that it has no units. Choose the unit it was drawn in.';
    case 'unrecognised':
      return `This drawing declares "${resolution.declaredValue ?? ''}", which Arq does not read. Choose the unit it was drawn in.`;
  }
}
