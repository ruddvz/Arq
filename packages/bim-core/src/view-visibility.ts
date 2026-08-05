import type { ViewDefinition } from './view-definition';

/**
 * V3-128: what a view shows, and what "hidden" does and does not mean.
 *
 * Two rules carry the weight here, and both are about hiding being a property
 * of a *view* rather than of the building.
 *
 * **Hiding never changes what exists.** A hidden wall is still in the model,
 * still holds its doors, still bounds its rooms, and still appears in every
 * schedule and quantity take-off. This is not a subtlety - it is the difference
 * between a drawing convention and a deletion. An architect who turns off
 * furniture to print a floor plan has not removed the furniture, and a schedule
 * that quietly agreed with the drawing would under-count an order. So nothing
 * in this module touches quantities, and `visibleForSchedule` exists to say so
 * in code rather than in a comment.
 *
 * **Hidden is not unreachable.** `model-tree-navigation.ts` already selects
 * hidden nodes deliberately, because a hidden object cannot be clicked and the
 * tree is the only way to reach it. Visibility here governs drawing, and
 * nothing else.
 *
 * The precedence order is the part that is easy to get wrong. Four rules can
 * each say "hide", and a user who has explicitly unhidden one wall expects it
 * shown even though its category is off - that is what "explicitly" means. So
 * a per-element override wins over everything, and the resolution reports
 * *which* rule decided, because "why is this not drawn" is a question a user
 * asks constantly and a boolean cannot answer.
 */

export type VisibilityDecider =
  /** No rule hid it. */
  | 'visible'
  /** The element sits on a level the view does not include. */
  | 'level-not-in-view'
  /** The view's filter hides the category. */
  | 'category-hidden'
  /** A temporary isolate: everything not isolated is hidden. */
  | 'not-isolated'
  /** The user hid this element specifically. */
  | 'element-hidden'
  /** The user un-hid this element specifically, overriding a rule above. */
  | 'element-shown';

export interface VisibilityResolution {
  readonly visible: boolean;
  readonly decidedBy: VisibilityDecider;
}

/** Per-element overrides, which win over category and level rules. */
export interface ElementVisibilityOverrides {
  readonly hidden: ReadonlySet<string>;
  readonly shown: ReadonlySet<string>;
}

export const NO_ELEMENT_OVERRIDES: ElementVisibilityOverrides = {
  hidden: new Set(),
  shown: new Set(),
};

export interface VisibilityQuery {
  readonly elementId: string;
  readonly category: string;
  /** Absent for an element not bound to a level, e.g. a site object. */
  readonly levelId?: string;
}

export interface VisibilityContext {
  readonly view: ViewDefinition;
  readonly overrides?: ElementVisibilityOverrides;
  /**
   * A temporary isolate. Null when nothing is isolated - distinct from an empty
   * set, which means "isolate nothing", i.e. hide everything. Conflating them
   * is how an isolate that was cleared leaves a blank drawing.
   */
  readonly isolatedElementIds?: ReadonlySet<string> | null;
}

/**
 * Resolves whether one element is drawn in one view.
 *
 * Order: explicit show, explicit hide, isolate, level, category. Explicit wins
 * because it is the only rule the user aimed at this element; everything else
 * is a rule about a group the element happens to be in, and a user who unhid
 * one wall did so knowing its category was off.
 */
export function resolveVisibility(
  query: VisibilityQuery,
  context: VisibilityContext,
): VisibilityResolution {
  const overrides = context.overrides ?? NO_ELEMENT_OVERRIDES;

  if (overrides.shown.has(query.elementId)) {
    return { visible: true, decidedBy: 'element-shown' };
  }
  if (overrides.hidden.has(query.elementId)) {
    return { visible: false, decidedBy: 'element-hidden' };
  }

  const isolated = context.isolatedElementIds;
  if (isolated !== undefined && isolated !== null && !isolated.has(query.elementId)) {
    return { visible: false, decidedBy: 'not-isolated' };
  }

  const viewLevels = context.view.filter.levelIds;
  if (viewLevels !== undefined) {
    // An element with no level is not on a listed level, so a view restricted
    // to levels excludes it. Treating "no level" as "every level" would put
    // site objects into an interior plan.
    if (query.levelId === undefined || !viewLevels.includes(query.levelId as never)) {
      return { visible: false, decidedBy: 'level-not-in-view' };
    }
  }

  if (context.view.filter.hiddenCategories.includes(query.category)) {
    return { visible: false, decidedBy: 'category-hidden' };
  }

  return { visible: true, decidedBy: 'visible' };
}

/**
 * Whether an element counts toward a schedule or quantity take-off.
 *
 * Always true. It takes no arguments about visibility because visibility is not
 * one of its inputs, and writing it as a function rather than leaving the rule
 * implicit is the point: a schedule that agreed with the drawing would
 * under-count an order the moment someone turned off a category to print.
 */
export function visibleForSchedule(): true {
  return true;
}

/**
 * Why an element is not drawn, in the user's terms.
 *
 * "Why can I not see this" is a question a user asks constantly, and the honest
 * answer names the rule and where to change it. A generic "hidden" sends them
 * hunting through four different controls.
 */
export function describeVisibility(resolution: VisibilityResolution): string | null {
  if (resolution.visible) {
    return null;
  }
  switch (resolution.decidedBy) {
    case 'element-hidden':
      return 'This element is hidden in this view.';
    case 'not-isolated':
      return 'This element is outside the current isolation.';
    case 'level-not-in-view':
      return 'This element is not on a level this view includes.';
    case 'category-hidden':
      return 'This view hides this category.';
    default:
      return null;
  }
}

/**
 * Applies a resolution across a set.
 *
 * Returns both halves rather than only the visible ones. A caller that renders
 * needs the visible list, and a caller that explains needs the hidden one with
 * its reasons - and a function returning only what is drawn makes the second
 * caller re-derive what it already computed.
 */
export function partitionByVisibility(
  queries: readonly VisibilityQuery[],
  context: VisibilityContext,
): {
  readonly visible: readonly VisibilityQuery[];
  readonly hidden: readonly (VisibilityQuery & { readonly reason: VisibilityDecider })[];
} {
  const visible: VisibilityQuery[] = [];
  const hidden: (VisibilityQuery & { reason: VisibilityDecider })[] = [];

  for (const query of queries) {
    const resolution = resolveVisibility(query, context);
    if (resolution.visible) {
      visible.push(query);
    } else {
      hidden.push({ ...query, reason: resolution.decidedBy });
    }
  }

  return { visible, hidden };
}

/**
 * Adds or removes an explicit override.
 *
 * Setting one clears the other: an element cannot be both explicitly hidden and
 * explicitly shown, and leaving a stale entry in the opposite set would make
 * the result depend on which is checked first - a rule nobody wrote down.
 */
export function withElementOverride(
  overrides: ElementVisibilityOverrides,
  elementId: string,
  override: 'hidden' | 'shown' | 'none',
): ElementVisibilityOverrides {
  const hidden = new Set(overrides.hidden);
  const shown = new Set(overrides.shown);
  hidden.delete(elementId);
  shown.delete(elementId);

  if (override === 'hidden') {
    hidden.add(elementId);
  } else if (override === 'shown') {
    shown.add(elementId);
  }

  return { hidden, shown };
}

/** Clears every override at once, for a "reset visibility" command. */
export function clearElementOverrides(): ElementVisibilityOverrides {
  return NO_ELEMENT_OVERRIDES;
}
