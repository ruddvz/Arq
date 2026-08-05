import { describe, expect, it } from 'vitest';
import { length } from './length';
import type { LevelId, ViewId } from './ids';
import { createViewDefinition, type ViewDefinition } from './view-definition';
import {
  NO_ELEMENT_OVERRIDES,
  clearElementOverrides,
  describeVisibility,
  partitionByVisibility,
  resolveVisibility,
  visibleForSchedule,
  withElementOverride,
  type VisibilityQuery,
} from './view-visibility';

const LEVEL_0 = 'level-0' as LevelId;
const LEVEL_1 = 'level-1' as LevelId;

function view(overrides: Partial<Parameters<typeof createViewDefinition>[0]> = {}): ViewDefinition {
  return createViewDefinition({
    id: 'view-1' as ViewId,
    name: 'Ground floor plan',
    kind: 'plan',
    levelId: LEVEL_0,
    range: { cutHeight: length(1200, 'mm'), viewDepth: length(1200, 'mm') },
    scale: 0.01,
    ...overrides,
  });
}

const WALL: VisibilityQuery = { elementId: 'wall-1', category: 'Wall', levelId: 'level-0' };
const CHAIR: VisibilityQuery = { elementId: 'chair-1', category: 'Furniture', levelId: 'level-0' };

describe('resolveVisibility', () => {
  it('shows an element no rule hides', () => {
    expect(resolveVisibility(WALL, { view: view() })).toEqual({
      visible: true,
      decidedBy: 'visible',
    });
  });

  it('hides a category the view filters out', () => {
    const filtered = view({ filter: { hiddenCategories: ['Furniture'] } });

    expect(resolveVisibility(CHAIR, { view: filtered })).toEqual({
      visible: false,
      decidedBy: 'category-hidden',
    });
    expect(resolveVisibility(WALL, { view: filtered }).visible).toBe(true);
  });

  it('hides an element on a level the view does not include', () => {
    const restricted = view({ filter: { hiddenCategories: [], levelIds: [LEVEL_0] } });
    const upstairs: VisibilityQuery = { ...WALL, levelId: 'level-1' };

    expect(resolveVisibility(upstairs, { view: restricted })).toEqual({
      visible: false,
      decidedBy: 'level-not-in-view',
    });
  });

  it('excludes an element with no level from a level-restricted view', () => {
    // Treating "no level" as "every level" would put site objects into an
    // interior plan.
    const restricted = view({ filter: { hiddenCategories: [], levelIds: [LEVEL_0, LEVEL_1] } });
    const siteObject: VisibilityQuery = { elementId: 'tree-1', category: 'Site' };

    expect(resolveVisibility(siteObject, { view: restricted }).decidedBy).toBe('level-not-in-view');
  });

  it('lets an explicit show beat a hidden category', () => {
    // That is what "explicitly" means: the user aimed at this element knowing
    // its category was off.
    const filtered = view({ filter: { hiddenCategories: ['Furniture'] } });
    const overrides = withElementOverride(NO_ELEMENT_OVERRIDES, 'chair-1', 'shown');

    expect(resolveVisibility(CHAIR, { view: filtered, overrides })).toEqual({
      visible: true,
      decidedBy: 'element-shown',
    });
  });

  it('lets an explicit hide beat everything else', () => {
    const overrides = withElementOverride(NO_ELEMENT_OVERRIDES, 'wall-1', 'hidden');

    expect(resolveVisibility(WALL, { view: view(), overrides }).decidedBy).toBe('element-hidden');
  });

  it('hides everything outside an isolation', () => {
    const isolated = new Set(['wall-1']);

    expect(resolveVisibility(WALL, { view: view(), isolatedElementIds: isolated }).visible).toBe(
      true,
    );
    expect(resolveVisibility(CHAIR, { view: view(), isolatedElementIds: isolated }).decidedBy).toBe(
      'not-isolated',
    );
  });

  it('distinguishes no isolation from an empty one', () => {
    // Conflating them is how a cleared isolate leaves a blank drawing.
    expect(resolveVisibility(WALL, { view: view(), isolatedElementIds: null }).visible).toBe(true);
    expect(resolveVisibility(WALL, { view: view(), isolatedElementIds: new Set() }).visible).toBe(
      false,
    );
  });

  it('lets an explicit show beat an isolation', () => {
    const overrides = withElementOverride(NO_ELEMENT_OVERRIDES, 'chair-1', 'shown');

    expect(
      resolveVisibility(CHAIR, { view: view(), overrides, isolatedElementIds: new Set(['wall-1']) })
        .visible,
    ).toBe(true);
  });
});

describe('visibleForSchedule', () => {
  it('is unconditional, because hiding is a drawing convention and not a deletion', () => {
    // A schedule that agreed with the drawing would under-count an order the
    // moment someone turned off a category to print.
    expect(visibleForSchedule()).toBe(true);
    expect(visibleForSchedule.length).toBe(0);
  });
});

describe('describeVisibility', () => {
  it('says nothing for something that is drawn', () => {
    expect(describeVisibility({ visible: true, decidedBy: 'visible' })).toBeNull();
  });

  it('names the rule that decided, so a user knows where to change it', () => {
    // A generic "hidden" sends them hunting through four controls.
    expect(describeVisibility({ visible: false, decidedBy: 'category-hidden' })).toBe(
      'This view hides this category.',
    );
    expect(describeVisibility({ visible: false, decidedBy: 'not-isolated' })).toContain(
      'isolation',
    );
    expect(describeVisibility({ visible: false, decidedBy: 'level-not-in-view' })).toContain(
      'level',
    );
  });
});

describe('partitionByVisibility', () => {
  it('returns both halves with the hidden reasons attached', () => {
    // A caller that explains needs the hidden list, and returning only the
    // visible one makes it re-derive what was already computed.
    const filtered = view({ filter: { hiddenCategories: ['Furniture'] } });

    const { visible, hidden } = partitionByVisibility([WALL, CHAIR], { view: filtered });

    expect(visible.map((query) => query.elementId)).toEqual(['wall-1']);
    expect(hidden).toEqual([{ ...CHAIR, reason: 'category-hidden' }]);
  });

  it('is empty on both sides for no elements', () => {
    expect(partitionByVisibility([], { view: view() })).toEqual({ visible: [], hidden: [] });
  });
});

describe('withElementOverride', () => {
  it('clears the opposite override when setting one', () => {
    // A stale entry in the opposite set would make the result depend on which
    // is checked first - a rule nobody wrote down.
    const hidden = withElementOverride(NO_ELEMENT_OVERRIDES, 'wall-1', 'hidden');
    const shown = withElementOverride(hidden, 'wall-1', 'shown');

    expect(shown.hidden.has('wall-1')).toBe(false);
    expect(shown.shown.has('wall-1')).toBe(true);
  });

  it('removes an override entirely', () => {
    const hidden = withElementOverride(NO_ELEMENT_OVERRIDES, 'wall-1', 'hidden');
    const cleared = withElementOverride(hidden, 'wall-1', 'none');

    expect(cleared.hidden.size).toBe(0);
    expect(cleared.shown.size).toBe(0);
  });

  it('does not mutate what it was given', () => {
    const before = withElementOverride(NO_ELEMENT_OVERRIDES, 'wall-1', 'hidden');
    withElementOverride(before, 'wall-2', 'hidden');

    expect(before.hidden.has('wall-2')).toBe(false);
  });
});

describe('clearElementOverrides', () => {
  it('restores the empty state', () => {
    expect(clearElementOverrides()).toEqual(NO_ELEMENT_OVERRIDES);
  });
});
