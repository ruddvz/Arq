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
   * Product reachability is stricter than registry presence or repository
   * backing. Designed tools stay discoverable, but an unwired tool must carry
   * the canonical reason rather than becoming clickable merely because a
   * library implementation exists somewhere in the monorepo.
   */
  it('keeps unavailable tools present and honestly explained', () => {
    const { toolsByCategory } = buildToolRailModel('design', noIcon);
    const build = toolsByCategory.build ?? [];
    const stair = build.find((tool) => tool.id === 'stair');
    const door = build.find((tool) => tool.id === 'door');

    expect(stair?.disabledReason).toBe(
      'Stair is designed in the workspace registry but has no proven live product execution path',
    );
    expect(door?.disabledReason).toBe(
      'Door placement has repository backing but no live PlanCanvas execution path',
    );
  });

  it('passes resolved icons through and omits the key when there is none', () => {
    const { toolsByCategory } = buildToolRailModel('design', (id) => (id === 'wall' ? 'W' : null));
    const draw = toolsByCategory.draw ?? [];
    expect(draw.find((tool) => tool.id === 'wall')?.icon).toBe('W');
    expect(draw.find((tool) => tool.id === 'grid')).toBeDefined();
    expect('icon' in (draw.find((tool) => tool.id === 'grid') ?? {})).toBe(false);
  });
});
