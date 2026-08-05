import type { InvalidationPriority, InvalidationTarget, OutputKind } from './types';

/**
 * V3-123: invalidate derived meshes from what an operation changed, not from
 * what kind of operation it was.
 *
 * `createInvalidationPlan` already dedupes and orders targets. What produced
 * them was left to each caller, and the version every caller reaches for first
 * is invalidation by operation type: a wall changed, so invalidate the wall
 * meshes. That is correct and unusable. It re-meshes a building because someone
 * renamed a room, and the cost grows with the model while the change does not,
 * which is the same shape of failure V3-104 rules out for room boundaries.
 *
 * So the input here is the *effect* - which elements changed, and which of
 * their properties - and the mapping is a declared table from property to the
 * outputs that actually read it. Two consequences follow directly, and both are
 * the point:
 *
 * - A property no output consumes invalidates nothing. Renaming a wall does not
 *   re-mesh it, because no mesh reads the name.
 * - A property several outputs consume invalidates exactly those. Changing a
 *   wall's thickness re-meshes the wall and re-traces the rooms it bounds, and
 *   leaves the sheet index alone.
 *
 * The table is declared rather than inferred because inferring it means running
 * the generators to find out what they read, and a generator that reads
 * something conditionally would be wrong half the time. A declared table can be
 * wrong too, but it is wrong visibly, in one place, next to the reason.
 */

/** What changed about one element. */
export interface ElementEffect {
  readonly elementId: string;
  /** e.g. "Wall", "Room", "Door" - the same category string `IdentitySource` uses. */
  readonly category: string;
  readonly kind: 'created' | 'modified' | 'deleted';
  /**
   * Which properties moved. Empty for a creation or a deletion, where the
   * element's whole existence is the change and every consuming output is
   * affected regardless of which fields carry values.
   */
  readonly changedProperties: readonly string[];
  /** The level the element sits on, for outputs scoped to a level rather than an element. */
  readonly levelId?: string;
}

/** Whether an output is keyed by the element, or by the level it sits on. */
export type OutputScope = 'element' | 'level' | 'project';

export interface OutputConsumption {
  readonly outputKind: OutputKind;
  readonly scope: OutputScope;
  /**
   * Properties this output reads. `'*'` means every property, for an output
   * whose input is the element as a whole rather than named fields.
   */
  readonly properties: readonly string[];
}

export type EffectTable = Readonly<Record<string, readonly OutputConsumption[]>>;

/**
 * What each category's properties feed.
 *
 * Deliberately incomplete, and honest about it: it covers the categories this
 * repository has generators or schemas for. A category with no entry produces
 * no targets, which `unmappedCategories` reports rather than hides - silence
 * from a missing table row is indistinguishable from silence because nothing
 * needed doing, and only one of those is correct.
 */
export const DEFAULT_EFFECT_TABLE: EffectTable = {
  Wall: [
    {
      outputKind: 'wall-display-mesh',
      scope: 'element',
      properties: ['start', 'end', 'typeId', 'heightOverride', 'alignment', 'materialId'],
    },
    {
      outputKind: 'room-boundary',
      scope: 'level',
      // Only the properties that change where the wall *is*. A wall's material
      // cannot move a room boundary, and re-tracing for it would undo the
      // bound this exists to create.
      properties: ['start', 'end', 'typeId', 'alignment'],
    },
    {
      outputKind: 'plan-projection-tile',
      scope: 'level',
      // Named rather than wildcarded. `'*'` here would re-tile a floor because
      // someone edited a wall's description, which is the failure this module
      // exists to remove, wearing the table's own clothes.
      properties: ['start', 'end', 'typeId', 'alignment', 'heightOverride', 'materialId'],
    },
    { outputKind: 'search-index', scope: 'project', properties: ['name', 'mark'] },
  ],
  Room: [
    {
      outputKind: 'room-boundary',
      scope: 'level',
      properties: ['seedPoint', 'boundaryElementIds'],
    },
    {
      outputKind: 'plan-projection-tile',
      scope: 'level',
      properties: ['name', 'number', 'status'],
    },
    { outputKind: 'search-index', scope: 'project', properties: ['name', 'number'] },
  ],
  Door: [
    {
      outputKind: 'wall-display-mesh',
      scope: 'element',
      properties: ['hostWallId', 'offsetFromWallStart', 'width', 'height', 'sillHeight', 'typeId'],
    },
    {
      outputKind: 'plan-projection-tile',
      scope: 'level',
      // Swing and hand belong here and not on the mesh: a plan draws the swing
      // arc, and the 3D mesh of the opening does not change when it flips.
      properties: ['hostWallId', 'offsetFromWallStart', 'width', 'typeId', 'swing', 'hand', 'mark'],
    },
    { outputKind: 'search-index', scope: 'project', properties: ['name', 'mark'] },
  ],
  Window: [
    {
      outputKind: 'wall-display-mesh',
      scope: 'element',
      properties: ['hostWallId', 'offsetFromWallStart', 'width', 'height', 'sillHeight', 'typeId'],
    },
    {
      outputKind: 'plan-projection-tile',
      scope: 'level',
      properties: ['hostWallId', 'offsetFromWallStart', 'width', 'typeId', 'mark'],
    },
    { outputKind: 'search-index', scope: 'project', properties: ['name', 'mark'] },
  ],
};

export interface EffectInvalidationOptions {
  readonly table?: EffectTable;
  /**
   * Priority for a target. Supplied by the caller because priority depends on
   * what is on screen right now, which this module cannot know and must not
   * assume - defaulting everything to InteractiveCritical would make the
   * priority field meaningless.
   */
  readonly priorityFor?: (outputKind: OutputKind, scopeId: string) => InvalidationPriority;
  readonly projectId?: string;
}

export interface EffectInvalidationResult {
  readonly targets: readonly InvalidationTarget[];
  /** Categories the table has no row for. Reported, never silently skipped. */
  readonly unmappedCategories: readonly string[];
}

/**
 * Turns effects into invalidation targets.
 *
 * A creation or a deletion invalidates every output the category feeds,
 * whichever properties carry values: the element appearing or disappearing
 * changes each of them, and reading `changedProperties` on a deletion would
 * find an empty list and conclude nothing needed doing.
 *
 * A level-scoped output on an element with no level produces no target rather
 * than a target scoped to something invented. An invalidation aimed at the
 * wrong scope is worse than none: it clears a cache entry that was fine and
 * leaves the one that was not.
 */
export function invalidationsFromEffects(
  effects: readonly ElementEffect[],
  options: EffectInvalidationOptions = {},
): EffectInvalidationResult {
  const table = options.table ?? DEFAULT_EFFECT_TABLE;
  const priorityFor = options.priorityFor ?? (() => 'VisibleBackground' as InvalidationPriority);

  const targets: InvalidationTarget[] = [];
  const unmapped = new Set<string>();

  for (const effect of effects) {
    const consumptions = table[effect.category];
    if (consumptions === undefined) {
      unmapped.add(effect.category);
      continue;
    }

    const wholeElementChanged = effect.kind !== 'modified';

    for (const consumption of consumptions) {
      if (!wholeElementChanged && !consumes(consumption, effect.changedProperties)) {
        continue;
      }

      const scopeId = scopeIdFor(consumption.scope, effect, options.projectId);
      if (scopeId === null) {
        continue;
      }

      targets.push({
        outputKind: consumption.outputKind,
        scopeId,
        priority: priorityFor(consumption.outputKind, scopeId),
        reason: reasonFor(effect, consumption),
      });
    }
  }

  return { targets, unmappedCategories: [...unmapped].sort() };
}

function consumes(consumption: OutputConsumption, changedProperties: readonly string[]): boolean {
  if (consumption.properties.includes('*')) {
    return changedProperties.length > 0;
  }
  return changedProperties.some((property) => consumption.properties.includes(property));
}

function scopeIdFor(
  scope: OutputScope,
  effect: ElementEffect,
  projectId: string | undefined,
): string | null {
  switch (scope) {
    case 'element':
      return effect.elementId;
    case 'level':
      return effect.levelId ?? null;
    case 'project':
      return projectId ?? null;
    default:
      return null;
  }
}

function reasonFor(effect: ElementEffect, consumption: OutputConsumption): string {
  if (effect.kind !== 'modified') {
    return `${effect.category} ${effect.kind}`;
  }
  const relevant = consumption.properties.includes('*')
    ? effect.changedProperties
    : effect.changedProperties.filter((property) => consumption.properties.includes(property));
  return `${effect.category} ${relevant.join(', ')} changed`;
}

/**
 * Whether a change to `changedProperties` on `category` affects anything at all.
 *
 * The cheap check a caller runs before building effects, for the common edit
 * that touches only fields nothing derives from. Renaming a wall goes through
 * here and stops.
 */
export function effectsAnyOutput(
  category: string,
  changedProperties: readonly string[],
  table: EffectTable = DEFAULT_EFFECT_TABLE,
): boolean {
  const consumptions = table[category];
  if (consumptions === undefined) {
    // An unknown category cannot be ruled out from here, and guessing "no"
    // would silently skip everything a missing table row was meant to cover.
    return true;
  }
  return consumptions.some((consumption) => consumes(consumption, changedProperties));
}
