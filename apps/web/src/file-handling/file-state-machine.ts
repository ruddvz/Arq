/**
 * The "open a file" flow's own state, from the moment a user picks/drops a file
 * through native-open, import-with-review, or safe-mode - one pure reducer so
 * the whole flow (acquire -> detect -> route -> [import review] -> commit) has
 * a single source of truth apps/web's UI can render against, rather than ad
 * hoc component state scattered across the picker/dialog/progress views.
 * `routeBrowserFile` (route-file.ts) and @arq/file-ingress/@arq/arqfs supply
 * the real detection/import/open logic this state machine only sequences.
 */
import type { ArqfsSidecarDependency } from '@arq/arqfs/src/arqfs-preflight';

export type FileFlowState =
  | { readonly kind: 'idle' }
  | { readonly kind: 'acquiring'; readonly name: string }
  | { readonly kind: 'detecting'; readonly name: string }
  | {
      readonly kind: 'native-opening';
      readonly name: string;
      /**
       * Whether the picked bytes are the whole database. A write-ahead-log
       * database keeps its newest commits in a `-wal` sidecar, and a file
       * picker hands over one file - so "compatible" and "complete" are
       * different statements about the same accepted file, and the flow's own
       * governed policy requires the distinct ones to stay distinct.
       */
      readonly sidecarDependency: ArqfsSidecarDependency;
    }
  /**
   * A project session is being created: the Worker has the bytes and the open
   * checks are running. Distinct from `detecting`, which is byte inspection on
   * the main thread and reaches no SQLite, and distinct from `native-opening`,
   * which is a compatibility verdict and not an open at all.
   */
  | {
      readonly kind: 'opening-project';
      readonly name: string;
      /** The stage the staged-open state machine is on, for a progress label that is not a guess. */
      readonly stageName: string;
      /** Carried through the open: whether the picked bytes were the whole database stays true afterwards. */
      readonly sidecarDependency: ArqfsSidecarDependency;
    }
  /**
   * A real project is open and the workspace is showing it. Read-only: the
   * governed `file-flow` policy requires an opened project and a compatible file
   * to stay distinct states, and this is the first build in which both exist.
   */
  | {
      readonly kind: 'project-open-read-only';
      readonly name: string;
      readonly projectName: string;
      readonly revision: number;
      readonly sidecarDependency: ArqfsSidecarDependency;
      /** Present when the file opened with a condition worth stating (interrupted write, missing optional content). */
      readonly conditionNote: string | null;
    }
  | { readonly kind: 'import-options'; readonly name: string; readonly formatId: string }
  | {
      readonly kind: 'importing';
      readonly name: string;
      readonly requestId: string;
      readonly fraction: number;
    }
  | { readonly kind: 'staged-review'; readonly name: string; readonly requestId: string }
  | { readonly kind: 'migrating'; readonly name: string; readonly fraction: number }
  | { readonly kind: 'read-only-safe-mode'; readonly name: string; readonly reason: string }
  | {
      readonly kind: 'failed';
      readonly name?: string;
      readonly code: string;
      readonly message: string;
    };

export type FileFlowEvent =
  | { readonly type: 'acquire'; readonly name: string }
  | { readonly type: 'acquired' }
  /** Required, not optional: a caller that has not decided whether the file is complete must not be able to omit the answer and get the reassuring default. */
  | { readonly type: 'route-native'; readonly sidecarDependency: ArqfsSidecarDependency }
  | { readonly type: 'open-start'; readonly stageName: string }
  | { readonly type: 'open-stage'; readonly stageName: string }
  | {
      readonly type: 'project-opened';
      readonly projectName: string;
      readonly revision: number;
      readonly conditionNote: string | null;
    }
  | { readonly type: 'route-import'; readonly formatId: string }
  | { readonly type: 'import-start'; readonly requestId: string }
  | { readonly type: 'progress'; readonly fraction: number }
  | { readonly type: 'staged' }
  | { readonly type: 'safe-mode'; readonly reason: string }
  | { readonly type: 'fail'; readonly code: string; readonly message: string }
  | { readonly type: 'reset' };

export function reduceFileFlow(state: FileFlowState, event: FileFlowEvent): FileFlowState {
  if (event.type === 'reset') return { kind: 'idle' };
  if (event.type === 'acquire') return { kind: 'acquiring', name: event.name };
  if (event.type === 'fail') {
    return {
      kind: 'failed',
      ...('name' in state ? { name: state.name } : {}),
      code: event.code,
      message: event.message,
    };
  }
  if (event.type === 'safe-mode' && 'name' in state) {
    return { kind: 'read-only-safe-mode', name: state.name, reason: event.reason };
  }
  if (state.kind === 'acquiring' && event.type === 'acquired') {
    return { kind: 'detecting', name: state.name };
  }
  if (state.kind === 'detecting' && event.type === 'route-native') {
    return {
      kind: 'native-opening',
      name: state.name,
      sidecarDependency: event.sidecarDependency,
    };
  }
  if (state.kind === 'detecting' && event.type === 'route-import') {
    return { kind: 'import-options', name: state.name, formatId: event.formatId };
  }
  // An open may only start from a file already found compatible, so a caller
  // cannot skip preflight and go straight to opening.
  if (state.kind === 'native-opening' && event.type === 'open-start') {
    return {
      kind: 'opening-project',
      name: state.name,
      stageName: event.stageName,
      sidecarDependency: state.sidecarDependency,
    };
  }
  if (state.kind === 'opening-project' && event.type === 'open-stage') {
    return { ...state, stageName: event.stageName };
  }
  if (state.kind === 'opening-project' && event.type === 'project-opened') {
    return {
      kind: 'project-open-read-only',
      name: state.name,
      projectName: event.projectName,
      revision: event.revision,
      // Carried forward rather than re-derived: a write-ahead-log project that
      // opens successfully is still missing whatever its `-wal` sidecar held, and
      // a successful open must not be allowed to swallow that caution.
      sidecarDependency: state.sidecarDependency,
      conditionNote: event.conditionNote,
    };
  }
  if (state.kind === 'import-options' && event.type === 'import-start') {
    return { kind: 'importing', name: state.name, requestId: event.requestId, fraction: 0 };
  }
  if (state.kind === 'importing' && event.type === 'progress') {
    return { ...state, fraction: Math.max(0, Math.min(1, event.fraction)) };
  }
  if (state.kind === 'importing' && event.type === 'staged') {
    return { kind: 'staged-review', name: state.name, requestId: state.requestId };
  }
  return state;
}
