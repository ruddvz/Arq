import { describe, expect, it } from 'vitest';
import { length } from './length';
import type { LevelId, ViewId } from './ids';
import {
  VIEW_DEFINITION_DERIVED_INVALIDATIONS,
  createViewDefinition,
  isLevelBoundView,
  viewHidesCategory,
} from './view-definition';

const id = 'view-1' as ViewId;
const levelId = 'level-0' as LevelId;
const RANGE = { cutHeight: length(1200, 'mm'), viewDepth: length(1200, 'mm') };

describe('createViewDefinition', () => {
  it('stores the cut height, which decides what is in the drawing at all', () => {
    // Cut at 1200mm a standard window is in the plan; cut at 400mm it is not.
    const view = createViewDefinition({
      id,
      name: 'Ground floor plan',
      kind: 'plan',
      levelId,
      range: RANGE,
      scale: 0.01,
    });

    expect(view.range?.cutHeight).toEqual(length(1200, 'mm'));
    expect(view.scale).toBe(0.01);
  });

  it('stores the question and never the answer', () => {
    const view = createViewDefinition({
      id,
      name: 'Ground floor plan',
      kind: 'plan',
      levelId,
      range: RANGE,
      scale: 0.01,
    });

    expect(view).not.toHaveProperty('geometry');
    expect(view).not.toHaveProperty('lastRendered');
  });

  it('defaults the filter to hiding nothing rather than leaving it absent', () => {
    const view = createViewDefinition({
      id,
      name: 'Plan',
      kind: 'plan',
      levelId,
      range: RANGE,
      scale: 0.01,
    });

    expect(view.filter).toEqual({ hiddenCategories: [] });
  });

  it('rejects a plan with no level, which has nothing to be a plan of', () => {
    expect(() =>
      createViewDefinition({ id, name: 'Plan', kind: 'plan', range: RANGE, scale: 0.01 }),
    ).toThrow(/must name the level/);
  });

  it('rejects a plan with no range, rather than letting a renderer invent a cut height', () => {
    expect(() =>
      createViewDefinition({ id, name: 'Plan', kind: 'plan', levelId, scale: 0.01 }),
    ).toThrow(/must have a view range/);
  });

  it('rejects a section that carries a level, rather than ignoring it', () => {
    // A silently ignored field is one someone will set and expect to matter.
    expect(() =>
      createViewDefinition({ id, name: 'Section A', kind: 'section', levelId, scale: 0.02 }),
    ).toThrow(/not level-bound/);
  });

  it('rejects a section that carries a horizontal cut', () => {
    expect(() =>
      createViewDefinition({ id, name: 'Section A', kind: 'section', range: RANGE, scale: 0.02 }),
    ).toThrow(/does not take a horizontal cut/);
  });

  it('accepts a section with neither', () => {
    const view = createViewDefinition({
      id,
      name: 'Section A',
      kind: 'section',
      scale: 0.02,
    });

    expect(view.levelId).toBeUndefined();
    expect(view.range).toBeUndefined();
  });

  it('rejects a non-positive scale', () => {
    expect(() =>
      createViewDefinition({ id, name: 'Plan', kind: 'plan', levelId, range: RANGE, scale: 0 }),
    ).toThrow(RangeError);
  });

  it('rejects a negative view depth', () => {
    expect(() =>
      createViewDefinition({
        id,
        name: 'Plan',
        kind: 'plan',
        levelId,
        range: { cutHeight: length(1200, 'mm'), viewDepth: length(-100, 'mm') },
        scale: 0.01,
      }),
    ).toThrow(/viewDepth/);
  });

  it('rejects an empty name', () => {
    expect(() =>
      createViewDefinition({ id, name: '  ', kind: 'plan', levelId, range: RANGE, scale: 0.01 }),
    ).toThrow(RangeError);
  });
});

describe('isLevelBoundView', () => {
  it('holds for the kinds that take a horizontal cut through one level', () => {
    expect(isLevelBoundView('plan')).toBe(true);
    expect(isLevelBoundView('reflected-ceiling')).toBe(true);
  });

  it('does not hold for a section, which cuts through every level it passes', () => {
    expect(isLevelBoundView('section')).toBe(false);
    expect(isLevelBoundView('elevation')).toBe(false);
    expect(isLevelBoundView('three-dimensional')).toBe(false);
  });
});

describe('viewHidesCategory', () => {
  it('hides by category, so the rule still applies to elements added later', () => {
    const view = createViewDefinition({
      id,
      name: 'Plan',
      kind: 'plan',
      levelId,
      range: RANGE,
      filter: { hiddenCategories: ['Furniture'] },
      scale: 0.01,
    });

    expect(viewHidesCategory(view, 'Furniture')).toBe(true);
    expect(viewHidesCategory(view, 'Wall')).toBe(false);
  });
});

describe('VIEW_DEFINITION_DERIVED_INVALIDATIONS', () => {
  it('names what a view change invalidates without resolving which sheets point here', () => {
    expect(VIEW_DEFINITION_DERIVED_INVALIDATIONS).toContain('sheet-viewport');
    expect(VIEW_DEFINITION_DERIVED_INVALIDATIONS).toContain('visible-element-set');
  });
});
