/**
 * Doc 38 ("Tool System and Command Taxonomy"), `workspace-tool-registry.json`
 * and `workspace-state-machines.json` > `machines.tool`.
 *
 * Two separate questions get confused constantly in a 54-entry tool list, so
 * this module keeps them apart by name:
 *
 * - **Registry status** (`ToolContract.status`) is the *design* coverage marker
 *   the registry ships. Its own `important` field says so: "Status is a
 *   design/implementation coverage marker, not a shipping claim."
 * - **Repository backing** (`TOOLS_WITH_REPOSITORY_BACKING` below) is whether
 *   code in *this* monorepo actually performs the tool.
 *
 * The second is much smaller than the first, and the difference is the point.
 * Doc 38's own framing - "the package distinguishes between tools that already
 * exist or partially exist and things that are only designed for future
 * capability" - is only true in the product if code enforces it, so the tool
 * rail renders unbacked tools disabled-with-reason rather than as buttons that
 * arm a tool nothing can finish.
 */

import { TOOL_CONTRACTS, toolContract, type ToolContract, type ToolGroup } from './registry';
import type { WorkspaceMode } from './workspace-types';
import { toolGroupsForMode } from './mode-state';

/** `workspace-state-machines.json` > `machines.tool`, verbatim. */
export type ToolPhase =
  | 'inactive'
  | 'hover-discoverable'
  | 'armed'
  | 'previewing'
  | 'awaiting-numeric-input'
  | 'committing'
  | 'complete'
  | 'rejected'
  | 'cancelled';

/**
 * Tools with real implementing modules in this repository, each named. The
 * comment beside each entry is the evidence; an entry with no module is not
 * allowed in this list, which is what stops it quietly becoming a wish list.
 *
 * Notably absent: `dimension`. The current shell offers a Dimension button and
 * @arq/icons ships `dimension.svg`, but no dimension tool module exists in
 * @arq/editor-shell - an icon and a rail slot are not an implementation.
 */
export const TOOLS_WITH_REPOSITORY_BACKING: readonly string[] = [
  'select', // @arq/editor-shell point-selection.ts, hit-test.ts, candidate-cycling.ts
  'window-select', // @arq/editor-shell region-selection.ts ('window' mode)
  'crossing-select', // @arq/editor-shell region-selection.ts ('crossing' mode)
  'selection-filter', // @arq/editor-shell selection-filter.ts
  'wall', // @arq/editor-shell wall-draw-tool.ts
  'door', // @arq/editor-shell door-placement-tool.ts
  'window', // @arq/editor-shell window-placement-tool.ts
  'room-boundary', // @arq/editor-shell room-placement-tool.ts
  'pan', // @arq/editor-shell viewport-controller.ts panByScreenDelta
  'zoom', // @arq/editor-shell viewport-controller.ts zoomAtScreenPoint
  'fit', // @arq/editor-shell viewport-controller.ts fitToBounds
];

const BACKED = new Set(TOOLS_WITH_REPOSITORY_BACKING);

export function hasRepositoryBacking(toolId: string): boolean {
  return BACKED.has(toolId);
}

/**
 * Why a tool cannot be activated, or null when it can. Order matters: an
 * unknown id is a bug in the caller and says so, a mode mismatch is a
 * navigation fact the user can act on, and "not built yet" is the honest
 * default for the 43 registry tools this repository does not implement.
 */
export function toolUnavailableReason(toolId: string, mode: WorkspaceMode): string | null {
  const contract = toolContract(toolId);
  if (contract === null) {
    return `Unknown tool "${toolId}"`;
  }
  if (!toolGroupsForMode(mode).includes(contract.group)) {
    return `${contract.name} is not available in ${mode} mode`;
  }
  if (!hasRepositoryBacking(toolId)) {
    return `${contract.name} is designed but not built yet`;
  }
  return null;
}

export function isToolAvailable(toolId: string, mode: WorkspaceMode): boolean {
  return toolUnavailableReason(toolId, mode) === null;
}

export interface ToolState {
  readonly activeToolId: string;
  /**
   * The tool to fall back to on Escape. `workspace-tool-registry.json` >
   * `tools[].cancel`: "Escape returns to Select or previous persistent tool
   * according to tool contract."
   */
  readonly persistentToolId: string;
  readonly phase: ToolPhase;
}

export const INITIAL_TOOL_STATE: ToolState = Object.freeze({
  activeToolId: 'select',
  persistentToolId: 'select',
  phase: 'inactive',
});

/**
 * Arming a tool is *not* a model mutation - `workspace-tool-registry.json` >
 * `tools[].activation`: "typed tool/command; never direct renderer mutation".
 * The phase moves to `'armed'` and stops there; geometry only appears once the
 * caller drives `beginPreview` and then commits through @arq/operations.
 */
export function activateTool(state: ToolState, toolId: string, mode: WorkspaceMode): ToolState {
  if (!isToolAvailable(toolId, mode)) {
    return state;
  }
  return {
    activeToolId: toolId,
    persistentToolId: toolId === 'select' ? 'select' : state.persistentToolId,
    phase: 'armed',
  };
}

/**
 * `workspace-state-machines.json` > `invariants[2]`: "Tool preview never
 * becomes canonical until transaction commit." Preview is a phase in *this*
 * state machine and carries no document revision with it, so there is nothing
 * here for a stale preview to overwrite.
 */
export function beginPreview(state: ToolState): ToolState {
  return state.phase === 'armed' ? { ...state, phase: 'previewing' } : state;
}

export function requestNumericInput(state: ToolState): ToolState {
  return state.phase === 'previewing' || state.phase === 'armed'
    ? { ...state, phase: 'awaiting-numeric-input' }
    : state;
}

export function beginCommit(state: ToolState): ToolState {
  return state.phase === 'previewing' || state.phase === 'awaiting-numeric-input'
    ? { ...state, phase: 'committing' }
    : state;
}

/**
 * Resolves a commit. `accepted: false` lands in `'rejected'` rather than
 * silently returning to `'armed'`: a validation refusal is something the user
 * must be told about, and a phase that erases itself gives the shell nothing to
 * render a message from.
 */
export function resolveCommit(state: ToolState, accepted: boolean): ToolState {
  if (state.phase !== 'committing') {
    return state;
  }
  return { ...state, phase: accepted ? 'complete' : 'rejected' };
}

/**
 * Escape. From an in-progress phase it cancels the draft and returns the tool
 * to `'armed'` - the user wanted to abandon *this* wall, not the wall tool. A
 * second Escape, now from `'armed'`, falls back to the persistent tool.
 */
export function cancelTool(state: ToolState): ToolState {
  switch (state.phase) {
    case 'previewing':
    case 'awaiting-numeric-input':
    case 'committing':
      return { ...state, phase: 'cancelled' };
    case 'cancelled':
    case 'complete':
    case 'rejected':
      return { ...state, phase: 'armed' };
    case 'armed':
      return state.activeToolId === state.persistentToolId
        ? { ...state, phase: 'inactive' }
        : { ...state, activeToolId: state.persistentToolId, phase: 'armed' };
    case 'inactive':
    case 'hover-discoverable':
      return state;
  }
}

export interface ToolRailEntry {
  readonly tool: ToolContract;
  readonly available: boolean;
  readonly disabledReason: string | null;
}

/**
 * The rail contents for a mode: every tool in the mode's groups, each carrying
 * its own availability and reason. Unavailable tools are *returned*, not
 * filtered out, because doc 38 and the context-menu registry both want
 * unbuilt capability to stay discoverable-but-honest ("Unavailable action stays
 * visible with reason when discoverability matters") rather than invisible.
 */
export function toolRailEntriesForMode(mode: WorkspaceMode): readonly ToolRailEntry[] {
  const groups = new Set<ToolGroup>(toolGroupsForMode(mode));
  return TOOL_CONTRACTS.filter((tool) => groups.has(tool.group)).map((tool) => {
    const disabledReason = toolUnavailableReason(tool.id, mode);
    return { tool, available: disabledReason === null, disabledReason };
  });
}

export interface ToolCoverage {
  readonly registryTotal: number;
  readonly repositoryBacked: number;
  readonly designSpecifiedOnly: number;
}

/**
 * The number this repository is allowed to claim. Doc 38 lists 54 tools; the
 * honest statement is "54 designed, 11 backed by code here", and this function
 * is what the status doc and the validation script both quote so those two can
 * never drift from the registry.
 */
export function toolCoverage(): ToolCoverage {
  return {
    registryTotal: TOOL_CONTRACTS.length,
    repositoryBacked: TOOL_CONTRACTS.filter((tool) => hasRepositoryBacking(tool.id)).length,
    designSpecifiedOnly: TOOL_CONTRACTS.filter((tool) => !hasRepositoryBacking(tool.id)).length,
  };
}
