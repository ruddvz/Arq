/**
 * Runtime tool state.
 *
 * Design registry status, repository backing and product reachability are three
 * different facts. #420 makes `product-command-authority.ts` the only source of
 * product reachability. This module keeps the tool lifecycle, but never infers
 * availability from implementation modules existing somewhere in the repo.
 */

import { TOOL_CONTRACTS, toolContract, type ToolContract, type ToolGroup } from './registry';
import type { WorkspaceMode } from './workspace-types';
import { toolGroupsForMode } from './mode-state';
import {
  hasRepositoryBacking,
  resolveProductCommand,
  TOOLS_WITH_REPOSITORY_BACKING,
} from './product-command-authority';

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
 *
 * Repository backing is not consulted here. The canonical product descriptor
 * is what knows whether a live consumer exists and why an unavailable tool is
 * unavailable.
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
 * only produces a semantic operation when its valid preview commits.
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

/**
 * `workspace-state-machines.json` > `invariants[2]`: "Tool preview never
 * becomes canonical until transaction commit." Preview is a phase in this
 * state machine and carries no document revision with it.
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

/**
 * The rail is discoverable but honest: registered tools remain visible with the
 * canonical reason when they are not product-reachable.
 */
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

/** Keep this import live so coverage and the exported evidence list cannot drift. */
void TOOLS_WITH_REPOSITORY_BACKING;
