/**
 * Runtime tool state.
 *
 * Design registry status, repository backing and product reachability are three
 * different facts. `product-command-authority.ts` is the only source of product
 * reachability. This module keeps the tool lifecycle and consumes that truth.
 */

import { TOOL_CONTRACTS, toolContract, type ToolContract, type ToolGroup } from './registry';
import type { WorkspaceMode } from './workspace-types';
import { toolGroupsForMode } from './mode-state';
import { hasRepositoryBacking, resolveProductCommand } from './product-command-authority';

export { hasRepositoryBacking, TOOLS_WITH_REPOSITORY_BACKING } from './product-command-authority';

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
 * Why a tool cannot be activated, or null when it can.
 * Repository backing is not consulted here.
 */
export function toolUnavailableReason(
  toolId: string,
  mode: WorkspaceMode,
  readOnly = false,
): string | null {
  const contract = toolContract(toolId);
  if (contract === null) {
    return `Unknown tool "${toolId}"`;
  }
  const resolved = resolveProductCommand(toolId, { mode, readOnly });
  if (resolved === null) {
    return `${contract.name} has no canonical product command descriptor`;
  }
  return resolved.disabledReason;
}

export function isToolAvailable(
  toolId: string,
  mode: WorkspaceMode,
  readOnly = false,
): boolean {
  return toolUnavailableReason(toolId, mode, readOnly) === null;
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
 * Arming a tool is not itself a model mutation. A mutating tool such as Wall
 * produces its semantic operation only when a valid preview commits.
 */
export function activateTool(
  state: ToolState,
  toolId: string,
  mode: WorkspaceMode,
  readOnly = false,
): ToolState {
  if (!isToolAvailable(toolId, mode, readOnly)) {
    return state;
  }
  return {
    activeToolId: toolId,
    persistentToolId: toolId === 'select' ? 'select' : state.persistentToolId,
    phase: 'armed',
  };
}

/** Preview state is never canonical document state. */
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

export function resolveCommit(state: ToolState, accepted: boolean): ToolState {
  if (state.phase !== 'committing') {
    return state;
  }
  return { ...state, phase: accepted ? 'complete' : 'rejected' };
}

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

/** Registered tools stay discoverable, with the canonical reason when unavailable. */
export function toolRailEntriesForMode(
  mode: WorkspaceMode,
  readOnly = false,
): readonly ToolRailEntry[] {
  const groups = new Set<ToolGroup>(toolGroupsForMode(mode));
  return TOOL_CONTRACTS.filter((tool) => groups.has(tool.group)).map((tool) => {
    const disabledReason = toolUnavailableReason(tool.id, mode, readOnly);
    return { tool, available: disabledReason === null, disabledReason };
  });
}

export interface ToolCoverage {
  readonly registryTotal: number;
  readonly repositoryBacked: number;
  readonly designSpecifiedOnly: number;
}

/** Repository coverage is evidence reporting only, never shipping reachability. */
export function toolCoverage(): ToolCoverage {
  return {
    registryTotal: TOOL_CONTRACTS.length,
    repositoryBacked: TOOL_CONTRACTS.filter((tool) => hasRepositoryBacking(tool.id)).length,
    designSpecifiedOnly: TOOL_CONTRACTS.filter((tool) => !hasRepositoryBacking(tool.id)).length,
  };
}
