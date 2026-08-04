import type { StagedNativeProject } from '@arq/project-loading';
import type { ArqfsSelectedBytesSession } from './arqfs-worker-transport';

/**
 * Which project the workspace is showing, as one value.
 *
 * The lifecycle contract's rule is "keep A active until B commits, and a failure
 * opening B leaves A unchanged". That is only structurally true if there is one
 * place that holds "the active project" and one function that replaces it -
 * otherwise the guarantee depends on every caller remembering to unset the old
 * project last, which is precisely how a half-open state gets shipped.
 *
 * So: an attempt that fails never reaches this module, and `activateProject`
 * takes the previous state and returns both the next state and the resources the
 * caller must now release. The old Worker is named in the return value rather
 * than disposed here, because this module is a reducer - it stays free of side
 * effects so the ordering it enforces can be tested without a Worker at all.
 */
export interface ActiveNativeProject {
  readonly fileName: string;
  readonly staged: StagedNativeProject;
  readonly session: ArqfsSelectedBytesSession;
  /** The level whose plan is currently shown. Always one of the project's own levels. */
  readonly activeLevelId: string;
}

export type ActiveProjectState =
  /**
   * No native project is open. The workspace shows its own in-memory plan
   * document, which is editable and journalled - see canvas/plan-document.ts.
   */
  | { readonly kind: 'local-plan' }
  | { readonly kind: 'native-read-only'; readonly project: ActiveNativeProject };

export const NO_NATIVE_PROJECT: ActiveProjectState = { kind: 'local-plan' };

export interface ActivateProjectOutcome {
  readonly state: ActiveProjectState;
  /**
   * Sessions the caller must dispose now. Never includes the incoming project's
   * own session, and never empty when a project was replaced - a replacement
   * that forgot this would leave a Worker and a whole database resident for the
   * rest of the page's life.
   */
  readonly disposeSessions: readonly ArqfsSelectedBytesSession[];
}

/**
 * Commits a staged project as the active one. The previous project's session is
 * returned for disposal rather than being disposed first, so that the moment the
 * old project stops being readable is after the new one is in place.
 */
export function activateProject(
  current: ActiveProjectState,
  next: {
    readonly fileName: string;
    readonly staged: StagedNativeProject;
    readonly session: ArqfsSelectedBytesSession;
  },
): ActivateProjectOutcome {
  const firstLevel = next.staged.model.levels[0];
  if (firstLevel === undefined) {
    // The pipeline refuses a project with no levels, so this is unreachable
    // through the real open path. It is still handled rather than asserted,
    // because "unreachable" is a claim about today's callers.
    throw new Error('a project cannot be activated without a level to show');
  }
  return {
    state: {
      kind: 'native-read-only',
      project: {
        fileName: next.fileName,
        staged: next.staged,
        session: next.session,
        activeLevelId: firstLevel.id as string,
      },
    },
    disposeSessions: current.kind === 'native-read-only' ? [current.project.session] : [],
  };
}

/** Closes the active project and returns to the workspace's own plan document. */
export function closeActiveProject(current: ActiveProjectState): ActivateProjectOutcome {
  return {
    state: NO_NATIVE_PROJECT,
    disposeSessions: current.kind === 'native-read-only' ? [current.project.session] : [],
  };
}

/**
 * Switches which level's plan is shown. A level id the project does not define is
 * ignored rather than stored: a dangling active level would render an empty plan
 * that looks like an empty project.
 */
export function showLevel(current: ActiveProjectState, levelId: string): ActiveProjectState {
  if (current.kind !== 'native-read-only') {
    return current;
  }
  const known = current.project.staged.model.levels.some(
    (level) => (level.id as string) === levelId,
  );
  if (!known || current.project.activeLevelId === levelId) {
    return current;
  }
  return { kind: 'native-read-only', project: { ...current.project, activeLevelId: levelId } };
}

/** True when the workspace must refuse every authoring action. */
export function isReadOnly(state: ActiveProjectState): boolean {
  return state.kind === 'native-read-only';
}
