/**
 * Bridges `workspace-tool-registry.json`'s eight tool groups onto the existing
 * ToolRail's categories, so the workspace shell drives the repository's real
 * rail rather than a second one built beside it (Package 3.0 execution prompt
 * §0: "Package 3.0 extends/converges those contracts; it is not permission to
 * delete them and rebuild from screenshots.").
 *
 * This module is pure data. Icons are resolved by a caller-supplied function
 * because @arq/design-system stays icon-agnostic - the same reason
 * ToolRailToolDefinition takes an already-resolved `ReactNode` rather than an
 * icon name.
 */

import type { ReactNode } from 'react';
import { toolRailEntriesForMode, type ToolGroup, type WorkspaceMode } from '@arq/workspace';
import type { ToolRailCategory } from '../shell/tool-rail-state';
import type { ToolRailToolDefinition } from '../shell/tool-rail';

const GROUP_TO_CATEGORY: Readonly<Record<ToolGroup, ToolRailCategory>> = {
  Select: 'select',
  Draw: 'draw',
  Build: 'build',
  Modify: 'modify',
  Annotate: 'annotate',
  Measure: 'measure',
  View: 'view',
  Review: 'review',
};

export function toolRailCategoryForGroup(group: ToolGroup): ToolRailCategory {
  return GROUP_TO_CATEGORY[group];
}

export interface ToolRailModel {
  readonly toolsByCategory: Readonly<
    Partial<Record<ToolRailCategory, readonly ToolRailToolDefinition[]>>
  >;
  readonly visibleCategories: readonly ToolRailCategory[];
}

/**
 * Builds the rail for a mode straight from the registry.
 *
 * Unavailable tools are included, carrying their reason. Doc 38 draws the line
 * between "exists" and "designed for future capability" and the whole point of
 * surfacing it in the UI is that a user can see the shape of the product
 * without being lied to about what it does today - so a designed-but-unbuilt
 * tool appears, greyed, saying so.
 */
export function buildToolRailModel(
  mode: WorkspaceMode,
  resolveIcon: (toolId: string) => ReactNode,
): ToolRailModel {
  const byCategory = new Map<ToolRailCategory, ToolRailToolDefinition[]>();

  for (const entry of toolRailEntriesForMode(mode)) {
    const category = toolRailCategoryForGroup(entry.tool.group);
    const icon = resolveIcon(entry.tool.id);
    const definition: ToolRailToolDefinition = {
      id: entry.tool.id,
      label: entry.tool.name,
      ...(icon === undefined || icon === null ? {} : { icon }),
      ...(entry.disabledReason === null ? {} : { disabledReason: entry.disabledReason }),
    };
    const existing = byCategory.get(category);
    if (existing === undefined) {
      byCategory.set(category, [definition]);
    } else {
      existing.push(definition);
    }
  }

  return {
    toolsByCategory: Object.fromEntries(byCategory) as ToolRailModel['toolsByCategory'],
    visibleCategories: [...byCategory.keys()],
  };
}
