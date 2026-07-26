/**
 * ARQ-024: build tool rail.
 *
 * Blueprint section 12 > "Left tool rail": seven permanent categories
 * (Select, Draw, Build, Modify, Annotate, Measure, View - order is fixed by
 * the blueprint and must stay stable per that section's own rule). Rules
 * modelled here: "maximum one expanded category at a time" (expanding a
 * second category collapses whichever was open, never both open together);
 * "tool order remains stable" (`TOOL_RAIL_CATEGORIES` is the single fixed
 * source of that order - callers must not reorder it, e.g. by user
 * preference, which the blueprint defers as a "later" feature: "users can
 * pin later, but the default remains controlled").
 *
 * Deliberately does not import @arq/editor-shell's command-lifecycle
 * (ARQ-038): a rail category holds many tools, and this module only tracks
 * which one is currently selected, not that tool's own preview/segment
 * state machine - the same domain-agnostic layering plan-renderer's
 * snap-glyph-rendering.ts already established (redeclare, don't reach into
 * a domain package from a UI-shell package).
 */

/**
 * Reconciliation with UI/UX Package 3.0 (doc 38, `workspace-tool-registry.json`):
 * the registry organises 54 tools into *eight* groups - the blueprint's seven
 * plus **Review** (issue, comment, model health, compare revisions). Review is
 * appended rather than inserted so blueprint section 12's "order is fixed...
 * and must stay stable" holds for the seven categories it named: every existing
 * category keeps its index, and a user's muscle memory for the rail is
 * unchanged.
 *
 * Review sits last for a second reason. Its tools are all gated on
 * `CAP-collaboration`, which this repository does not enable, so the one
 * category that is entirely unavailable today is also the one furthest from the
 * categories that work.
 */
export const TOOL_RAIL_CATEGORIES = [
  'select',
  'draw',
  'build',
  'modify',
  'annotate',
  'measure',
  'view',
  'review',
] as const;

export type ToolRailCategory = (typeof TOOL_RAIL_CATEGORIES)[number];

export interface ToolRailState {
  readonly expandedCategory: ToolRailCategory | null;
  readonly activeToolId: string | null;
}

export const INITIAL_TOOL_RAIL_STATE: ToolRailState = {
  expandedCategory: null,
  activeToolId: null,
};

/** Clicking an already-expanded category's disclosure collapses it; any other click expands it (and implicitly collapses whatever was open). */
export function toggleCategory(state: ToolRailState, category: ToolRailCategory): ToolRailState {
  return {
    ...state,
    expandedCategory: state.expandedCategory === category ? null : category,
  };
}

/** Selecting a tool both expands its category (so the choice is visible) and sets it active. */
export function selectTool(
  state: ToolRailState,
  category: ToolRailCategory,
  toolId: string,
): ToolRailState {
  return { expandedCategory: category, activeToolId: toolId };
}

export function isCategoryExpanded(state: ToolRailState, category: ToolRailCategory): boolean {
  return state.expandedCategory === category;
}

export function isToolActive(state: ToolRailState, toolId: string): boolean {
  return state.activeToolId === toolId;
}
