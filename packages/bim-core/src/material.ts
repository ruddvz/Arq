import type { MaterialId } from './ids';

/**
 * V3-088: MaterialDefinition.
 *
 * A material is referenced by types and instances rather than embedded in
 * them, because the same brick appears in a dozen wall types and one
 * correction to its name or its schedule key has to reach all of them. That is
 * the same reference-not-copy choice `Wall.typeId` already makes, applied one
 * level down.
 *
 * The definition is deliberately thin. A material in a real BIM tool carries a
 * thermal conductivity, a density, a fire rating, a cost code, a cut pattern, a
 * surface pattern, a render appearance and whatever else the analysis packages
 * plugged into it demand. Every one of those is a claim about the physical
 * world that Arq has no source for yet, and a field carrying a fabricated
 * default is worse than an absent one: it schedules, exports and prints as if
 * someone had checked it.
 *
 * So this stores what the drafting model itself needs - identity, what the
 * material is called, how it is drawn when cut, and a slot for the properties
 * that arrive later with a source attached.
 */

/**
 * How a material reads when a drawing cuts through it.
 *
 * Named rather than numeric, and open by construction: the pattern catalogue is
 * a drafting-standards question that varies by office and by region, and the
 * `sheet.ts` reasoning about standard paper sizes applies unchanged - inventing
 * a fixed enum here would present an undecided catalogue as decided.
 */
export interface MaterialCutPattern {
  /** Catalogue key, e.g. "concrete-cast-in-place", "masonry-brick". */
  readonly name: string;
  /** Degrees clockwise from horizontal. Hatch angle is per-material, not per-drawing. */
  readonly angleDegrees: number;
  /** Spacing between hatch lines in millimetres of paper, not of model. */
  readonly spacingPaperMm: number;
}

/**
 * A physical property carried with its provenance.
 *
 * The provenance is not decoration. A U-value a user typed, a U-value from a
 * manufacturer's datasheet and a U-value Arq guessed have different standing in
 * a compliance conversation, and a schedule that prints all three identically
 * is how an unchecked number ends up in a submission. `source` is required so
 * no property can enter the model without one.
 */
export interface MaterialProperty {
  readonly key: string;
  readonly value: number;
  /** Unit symbol as written, e.g. "W/mK". Not parsed here - see V3-100. */
  readonly unit: string;
  readonly source: 'user' | 'manufacturer' | 'standard' | 'estimated';
}

export interface MaterialDefinition {
  readonly id: MaterialId;
  /** What the material is called in schedules and legends. */
  readonly name: string;
  /**
   * Optional office or manufacturer code. Kept distinct from `name` because a
   * legend prints the name and a schedule keys on the code, and collapsing them
   * means renaming a material silently rewrites the schedule key.
   */
  readonly code?: string;
  readonly cutPattern?: MaterialCutPattern;
  readonly properties: readonly MaterialProperty[];
}

export interface CreateMaterialInput {
  readonly id: MaterialId;
  readonly name: string;
  readonly code?: string;
  readonly cutPattern?: MaterialCutPattern;
  readonly properties?: readonly MaterialProperty[];
}

/**
 * Constructs a MaterialDefinition.
 *
 * Rejects an empty name, a non-finite or non-positive hatch spacing, and a
 * duplicate property key. The duplicate check matters more than it looks: two
 * entries for `thermal-conductivity` means every reader picks one, and which
 * one it picks decides whether the wall passes.
 */
export function createMaterial(input: CreateMaterialInput): MaterialDefinition {
  if (input.name.trim().length === 0) {
    throw new RangeError('a MaterialDefinition must have a non-empty name');
  }
  if (input.cutPattern) {
    const { spacingPaperMm, angleDegrees } = input.cutPattern;
    if (!Number.isFinite(spacingPaperMm) || spacingPaperMm <= 0) {
      throw new RangeError('cutPattern.spacingPaperMm must be a positive finite number');
    }
    if (!Number.isFinite(angleDegrees)) {
      throw new RangeError('cutPattern.angleDegrees must be finite');
    }
  }

  const properties = input.properties ?? [];
  const seen = new Set<string>();
  for (const property of properties) {
    if (seen.has(property.key)) {
      throw new RangeError(`duplicate material property key: ${property.key}`);
    }
    seen.add(property.key);
  }

  return {
    id: input.id,
    name: input.name,
    ...(input.code === undefined ? {} : { code: input.code }),
    ...(input.cutPattern === undefined ? {} : { cutPattern: input.cutPattern }),
    properties,
  };
}

/** Looks a property up by key. Returns undefined rather than a zero: an absent property is not a measured zero. */
export function findMaterialProperty(
  material: MaterialDefinition,
  key: string,
): MaterialProperty | undefined {
  return material.properties.find((property) => property.key === key);
}

/**
 * What changing a MaterialDefinition invalidates.
 *
 * Declared rather than computed, matching `WALL_TYPE_DERIVED_INVALIDATIONS` and
 * `SLAB_TYPE_DERIVED_INVALIDATIONS`: this module cannot know which types
 * reference a material, and pretending to would put that lookup here instead of
 * where the model actually lives.
 */
export const MATERIAL_DERIVED_INVALIDATIONS = [
  'cut-pattern-render',
  'material-legend',
  'quantity-schedule',
  'surface-appearance',
] as const;
