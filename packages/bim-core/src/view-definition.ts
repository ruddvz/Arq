import type { Length } from './length';
import type { LevelId, ViewId } from './ids';

/**
 * V3-085: ViewDefinition.
 *
 * `sheet.ts` (ARQ-140) already references `ViewId` as an opaque id, noting that
 * View is its own core entity with no schema in this repository yet and that
 * modelling it is a separate issue. This is that issue, and the reason it
 * matters more than "a sheet needs something to point at" is the range: a plan,
 * a section and a schedule view of the same building are the same model seen
 * through different rules, and if those rules live in the renderer rather than
 * in a record, two surfaces showing "the same view" show different things.
 *
 * Like a schedule, a view stores the question and never the answer. There is no
 * cached geometry, no computed extent, no last-rendered image. A view that
 * remembered what it drew would be a second copy of the model that goes stale
 * silently, and a drawing set is exactly where a stale copy does damage.
 *
 * The cut plane is the field this exists for. A plan is a horizontal section
 * through a building at some height, and which height decides whether a window
 * appears at all - cut at 1200mm a standard window is in the drawing, cut at
 * 400mm it is not. Leaving that implicit means every renderer picks its own,
 * and two views of one floor disagree about what is in the building.
 */

export type ViewKind = 'plan' | 'reflected-ceiling' | 'section' | 'elevation' | 'three-dimensional';

/**
 * How far below the cut a view still draws.
 *
 * A plan shows the floor under the cut plane, not just the slice at it. `depth`
 * is how far down that goes: a plan with no depth is a single infinitely thin
 * slice, which draws almost nothing.
 */
export interface ViewRange {
  /** Height above the level datum at which the horizontal cut is taken. */
  readonly cutHeight: Length;
  /** How far below the cut the view still draws. */
  readonly viewDepth: Length;
}

/**
 * What a view hides.
 *
 * Category names rather than element ids, because a view's rule is "no
 * furniture", not "not that chair" - listing ids would make the rule fail
 * silently for every element added after it was written. Per-element overrides
 * are a separate concern belonging wherever hiding is applied.
 */
export interface ViewFilter {
  readonly hiddenCategories: readonly string[];
  /** When set, only elements on these levels appear, whatever the view range says. */
  readonly levelIds?: readonly LevelId[];
}

export interface ViewDefinition {
  readonly id: ViewId;
  readonly name: string;
  readonly kind: ViewKind;
  /**
   * The level a plan or reflected ceiling plan is taken from. Absent for a
   * section, an elevation or a 3D view, which are not level-bound - a section
   * cuts through every level it passes.
   */
  readonly levelId?: LevelId;
  /** Present for the view kinds that take a horizontal cut. */
  readonly range?: ViewRange;
  readonly filter: ViewFilter;
  /**
   * Drawing scale as a ratio, e.g. 1:100 stored as 0.01. Held on the view
   * rather than only on the sheet viewport because scale decides what detail is
   * drawn at all, not just how large it prints - a 1:200 plan omits what a 1:20
   * detail exists to show.
   */
  readonly scale: number;
}

export interface CreateViewDefinitionInput {
  readonly id: ViewId;
  readonly name: string;
  readonly kind: ViewKind;
  readonly levelId?: LevelId;
  readonly range?: ViewRange;
  readonly filter?: ViewFilter;
  readonly scale: number;
}

/** The kinds that take a horizontal cut through a level, and so need a level and a range. */
export const LEVEL_BOUND_VIEW_KINDS: readonly ViewKind[] = ['plan', 'reflected-ceiling'];

export function isLevelBoundView(kind: ViewKind): boolean {
  return LEVEL_BOUND_VIEW_KINDS.includes(kind);
}

/**
 * Constructs a ViewDefinition.
 *
 * The checks are the ones a record can make about itself. A plan without a
 * level has nothing to be a plan of; a plan without a range has no cut height,
 * and the alternative to rejecting it is a renderer inventing one. A section
 * carrying a level or a range is rejected too, rather than ignored: a field
 * that is silently ignored is a field someone will set and expect to matter.
 */
export function createViewDefinition(input: CreateViewDefinitionInput): ViewDefinition {
  if (input.name.trim().length === 0) {
    throw new RangeError('a ViewDefinition must have a non-empty name');
  }
  if (!Number.isFinite(input.scale) || input.scale <= 0) {
    throw new RangeError('scale must be a positive finite ratio');
  }

  if (isLevelBoundView(input.kind)) {
    if (input.levelId === undefined) {
      throw new RangeError(`a ${input.kind} view must name the level it is taken from`);
    }
    if (input.range === undefined) {
      throw new RangeError(`a ${input.kind} view must have a view range`);
    }
    if (!Number.isFinite(input.range.cutHeight.value)) {
      throw new RangeError('range.cutHeight must be finite');
    }
    if (!Number.isFinite(input.range.viewDepth.value) || input.range.viewDepth.value < 0) {
      throw new RangeError('range.viewDepth must be a non-negative finite length');
    }
  } else {
    if (input.levelId !== undefined) {
      throw new RangeError(`a ${input.kind} view is not level-bound and must not name a level`);
    }
    if (input.range !== undefined) {
      throw new RangeError(`a ${input.kind} view does not take a horizontal cut`);
    }
  }

  return {
    id: input.id,
    name: input.name,
    kind: input.kind,
    ...(input.levelId === undefined ? {} : { levelId: input.levelId }),
    ...(input.range === undefined ? {} : { range: input.range }),
    filter: input.filter ?? { hiddenCategories: [] },
    scale: input.scale,
  };
}

/** Whether a view's filter hides a category. */
export function viewHidesCategory(view: ViewDefinition, category: string): boolean {
  return view.filter.hiddenCategories.includes(category);
}

/**
 * What changing a ViewDefinition invalidates.
 *
 * Declared rather than computed, matching the other entities. A view is
 * referenced by sheet viewports, and this module has no sheet table - resolving
 * which viewports point here belongs where the sheets live.
 */
export const VIEW_DEFINITION_DERIVED_INVALIDATIONS = [
  'view-geometry',
  'sheet-viewport',
  'annotation-placement',
  'visible-element-set',
] as const;
