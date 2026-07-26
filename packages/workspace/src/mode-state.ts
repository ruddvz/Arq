/**
 * Doc 34 ("In-Project Information Architecture") > "Modes".
 *
 * Doc 33's rule for mode switching is a rule about what must *not* happen:
 * "Switching modes does not save, publish, sync or regenerate by itself." So
 * `switchMode` returns a new `WorkspaceModeState` and nothing else - no side
 * effect, no callback, no promise. It cannot save because it has nothing to
 * save with.
 *
 * The project context is carried through by reference precisely so that doc
 * 33's "what persists while moving around" list (project identity, revision,
 * save state, sync state, permissions) is enforced by types rather than by a
 * reviewer noticing.
 */

import { TOOL_GROUPS, type ToolGroup } from './registry';
import type { WorkspaceMode, WorkspaceProjectContext, WorkspaceSelection } from './workspace-types';

export interface WorkspaceModeState {
  readonly mode: WorkspaceMode;
  readonly project: WorkspaceProjectContext;
  readonly selection: WorkspaceSelection;
  /**
   * Doc 34: the inspector should "default to the most relevant [tab] for
   * context while preserving the user's manual selection during the session."
   * Remembering the mode the user came from is what makes returning to Design
   * after a detour into Review feel like coming back rather than restarting.
   */
  readonly previousMode: WorkspaceMode | null;
}

/**
 * The tool groups each mode surfaces on its rail, from doc 34's mode
 * descriptions. Every group still *exists* in every mode - this is which ones
 * the rail leads with, not a permission system. Present deliberately offers
 * none: doc 34 defines it as "saved views shown with minimal authoring chrome",
 * so a tool rail there would be chrome the mode exists to remove.
 */
export const MODE_TOOL_GROUPS: Readonly<Record<WorkspaceMode, readonly ToolGroup[]>> = {
  design: ['Select', 'Draw', 'Build', 'Modify', 'Measure', 'View'],
  document: ['Select', 'Annotate', 'View'],
  inspect: ['Select', 'Measure', 'View'],
  review: ['Select', 'Review', 'View'],
  present: ['View'],
};

/** Doc 34: which view kinds each mode leads with when opening a new surface. */
export const MODE_PRIMARY_VIEW_KINDS: Readonly<Record<WorkspaceMode, readonly string[]>> = {
  design: ['plan', '3d', 'section', 'elevation'],
  document: ['sheet', 'schedule', 'report'],
  inspect: ['plan', '3d', 'model-health'],
  review: ['issues', 'compare'],
  present: ['plan', '3d'],
};

export function initialModeState(
  project: WorkspaceProjectContext,
  mode: WorkspaceMode = 'design',
): WorkspaceModeState {
  return {
    mode,
    project,
    selection: { primaryId: null, secondaryIds: new Set() },
    previousMode: null,
  };
}

/**
 * Doc 33: "Mode and view changes preserve the project, current document
 * revision, local save state, sync state, undo boundary, permissions and
 * relevant selection." Selection carries across unchanged - a user who selects
 * a wall in Design and switches to Inspect expects to be inspecting *that
 * wall*, which is the entire reason Inspect is a mode rather than a panel.
 */
export function switchMode(state: WorkspaceModeState, mode: WorkspaceMode): WorkspaceModeState {
  if (state.mode === mode) {
    return state;
  }
  return { ...state, mode, previousMode: state.mode };
}

/**
 * Present is the one mode a read-only project can always enter, and Design is
 * the one it cannot. Returning a reason string rather than a bare boolean is
 * the execution prompt's §3 rule ("every action must map to an... enabled/
 * disabled reason") applied to the mode rail: a disabled Design button that
 * cannot say why is a mystery control.
 */
export function modeUnavailableReason(
  project: WorkspaceProjectContext,
  mode: WorkspaceMode,
): string | null {
  if (project.openState === 'project-loading') {
    return 'Project is still loading';
  }
  if (project.openState === 'project-fatal-error') {
    return 'Project could not be opened';
  }
  if (project.openState === 'project-recovery-required') {
    return mode === 'present' ? null : 'Recovery must be completed before editing';
  }
  if (project.readOnly && (mode === 'design' || mode === 'document')) {
    return 'You have read-only access to this project';
  }
  return null;
}

export function isModeAvailable(project: WorkspaceProjectContext, mode: WorkspaceMode): boolean {
  return modeUnavailableReason(project, mode) === null;
}

/**
 * Refuses the switch rather than throwing. A mode rail renders unavailable
 * modes as disabled-with-reason, so reaching this guard means something got
 * past the UI - a stale keyboard shortcut, a restored session, a permission
 * that changed under the user. None of those should crash the workspace.
 */
export function switchModeIfAvailable(
  state: WorkspaceModeState,
  mode: WorkspaceMode,
): WorkspaceModeState {
  return isModeAvailable(state.project, mode) ? switchMode(state, mode) : state;
}

export function toolGroupsForMode(mode: WorkspaceMode): readonly ToolGroup[] {
  return MODE_TOOL_GROUPS[mode];
}

/** Exposed for the registry-integrity test: every mode group must be a real group. */
export function allRegistryToolGroups(): readonly ToolGroup[] {
  return TOOL_GROUPS;
}
