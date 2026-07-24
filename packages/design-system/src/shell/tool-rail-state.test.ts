import { describe, expect, it } from 'vitest';
import {
  INITIAL_TOOL_RAIL_STATE,
  TOOL_RAIL_CATEGORIES,
  isCategoryExpanded,
  isToolActive,
  selectTool,
  toggleCategory,
} from './tool-rail-state';

describe('TOOL_RAIL_CATEGORIES', () => {
  it('has exactly the seven blueprint categories, in the fixed order', () => {
    expect(TOOL_RAIL_CATEGORIES).toEqual([
      'select',
      'draw',
      'build',
      'modify',
      'annotate',
      'measure',
      'view',
    ]);
  });
});

describe('toggleCategory', () => {
  it('expands a collapsed category', () => {
    const next = toggleCategory(INITIAL_TOOL_RAIL_STATE, 'draw');
    expect(isCategoryExpanded(next, 'draw')).toBe(true);
  });

  it('collapses an already-expanded category (toggle off)', () => {
    const expanded = toggleCategory(INITIAL_TOOL_RAIL_STATE, 'draw');
    const collapsed = toggleCategory(expanded, 'draw');
    expect(collapsed.expandedCategory).toBeNull();
  });

  it('never has two categories expanded at once', () => {
    const drawExpanded = toggleCategory(INITIAL_TOOL_RAIL_STATE, 'draw');
    const buildExpanded = toggleCategory(drawExpanded, 'build');
    expect(isCategoryExpanded(buildExpanded, 'draw')).toBe(false);
    expect(isCategoryExpanded(buildExpanded, 'build')).toBe(true);
  });
});

describe('selectTool', () => {
  it('sets the active tool and expands its category', () => {
    const next = selectTool(INITIAL_TOOL_RAIL_STATE, 'draw', 'wall-draw');
    expect(isToolActive(next, 'wall-draw')).toBe(true);
    expect(isCategoryExpanded(next, 'draw')).toBe(true);
  });

  it('replaces a previously active tool', () => {
    const first = selectTool(INITIAL_TOOL_RAIL_STATE, 'draw', 'wall-draw');
    const second = selectTool(first, 'measure', 'dimension');
    expect(isToolActive(second, 'wall-draw')).toBe(false);
    expect(isToolActive(second, 'dimension')).toBe(true);
  });
});
