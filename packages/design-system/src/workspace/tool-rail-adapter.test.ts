import { describe, expect, it } from 'vitest';
import { TOOL_GROUPS } from '@arq/workspace';
import { TOOL_RAIL_CATEGORIES } from '../shell/tool-rail-state';
import { buildToolRailModel, toolRailCategoryForGroup } from './tool-rail-adapter';

const noIcon = (): null => null;

describe('toolRailCategoryForGroup', () => {
  it('maps every registry group onto a real rail category', () => {
    for (const group of TOOL_GROUPS) {
      expect(TOOL_RAIL_CATEGORIES).toContain(toolRailCategoryForGroup(group));
    }
  });

  it('covers all eight groups without collisions', () => {
    const categories = TOOL_GROUPS.map(toolRailCategoryForGroup);
    expect(new Set(categories).size).toBe(TOOL_GROUPS.length);
  });
});

describe('buildToolRailModel', () => {
  it('shows only the categories a mode carries', () => {
    expect(buildToolRailModel('present', noIcon).visibleCategories).toEqual(['view']);
    expect([...buildToolRailModel('review', noIcon).visibleCategories].sort()).toEqual([
      'review',
      'select',
      'view',
    ]);
  });

  it('lists categories in rail order, not registry order', () => {
    const { visibleCategories } = buildToolRailModel('design', noIcon);
    const rank = (category: string): number => TOOL_RAIL_CATEGORIES.indexOf(category as never);
    expect(visibleCategories.map(rank)).toEqual(
      [...visibleCategories.map(rank)].sort((a, b) => a - b),
    );
  });

  /**
   * Doc 38's distinction, made visible: a designed-but-unbuilt tool is in the
   * rail, disabled, with the sentence that explains it - not silently missing
   * and not silently clickable.
   */
  it('keeps unbuilt tools present and explained', () => {
    const { toolsByCategory } = buildToolRailModel('design', noIcon);
    const build = toolsByCategory.build ?? [];
    const stair = build.find((tool) => tool.id === 'stair');
    const door = build.find((tool) => tool.id === 'door');
    expect(stair?.disabledReason).toBe('Stair is designed but not built yet');
    expect(door?.disabledReason).toBeUndefined();
  });

  it('passes resolved icons through and omits the key when there is none', () => {
    const { toolsByCategory } = buildToolRailModel('design', (id) => (id === 'wall' ? 'W' : null));
    const draw = toolsByCategory.draw ?? [];
    expect(draw.find((tool) => tool.id === 'wall')?.icon).toBe('W');
    expect(draw.find((tool) => tool.id === 'grid')).toBeDefined();
    expect('icon' in (draw.find((tool) => tool.id === 'grid') ?? {})).toBe(false);
  });
});
