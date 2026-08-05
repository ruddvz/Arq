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

/**
 * Why a project stopped. One kind with an exhaustive reason, rather than a
 * dozen near-identical state kinds: every one of these leaves the flow in the
 * same shape - nothing is open, the previous project is untouched, and the user
 * needs the specific cause plus a way out. Splitting them into separate kinds
 * would duplicate that structure a dozen times and let the cases drift apart.
 * The reason stays a closed union so a new cause cannot be reported as a string
 * nobody has written copy for.
 */
export type ProjectOpenFailureReason =
  | 'unsupported-version'
  | 'unsupported-capability'
  | 'invalid-header'
  | 'truncated'
  | 'corrupt'
  | 'migration-failed'
  | 'integrity-failed'
  | 'worker-failed'
  | 'hydration-failed'
  | 'quota-exhausted'
  | 'permission-denied'
  | 'publication-failed'
  | 'recovery-failed';

/**
 * Why an open project may not be written. There is more than one cause and they
 * are not interchangeable: a file from a newer ARQ is read-only because of the
 * file, and a project opened by this build is read-only because of the build.
 * Telling a reader the wrong one is a false statement about their own work, so
 * the cause travels with the state and the copy layer branches on it.
 */
export type ProjectReadOnlyReason =
  /**
   * ADR-0028: this build owns no working copy and has no durable write path, so
   * every project it opens is an inspection of bytes it will never modify.
   */
  | 'build-cannot-write'
  /** The file's format version is ahead of this build: readable, not writable. */
  | 'newer-format-version';

/**
 * What an open project can say about itself beyond its file name, learned by
 * hydration and not before. Grouped rather than spread across the state because
 * these four facts arrive together, from one read of one project, and a state
 * holding some of them would invite a surface to render half an identity.
 */
export interface OpenProjectFacts {
  readonly projectName: string;
  readonly revision: number;
  /**
   * Carried into the opened state rather than left behind at preflight: a
   * write-ahead-log project that opens successfully is still missing whatever
   * its absent `-wal` sidecar held, and a successful open must not be allowed to
   * swallow that caution.
   */
  readonly sidecarDependency: ArqfsSidecarDependency;
  /** Present when the file opened with a condition worth stating (interrupted write, missing optional content). */
  readonly conditionNote: string | null;
}

/**
 * The last project this session had fully active, carried through every failed
 * transition. ADR-0028 requires that a failure never silently replaces the last
 * known good project, so this rides on the failure states themselves rather
 * than living in separate component state that a re-render could drop.
 */
export interface LastKnownGoodProject {
  readonly projectId: string;
  readonly name: string;
}

export type FileFlowState =
  | { readonly kind: 'idle' }
  | { readonly kind: 'acquiring'; readonly name: string }
  | { readonly kind: 'detecting'; readonly name: string }
  /**
   * The candidate passed byte preflight *and* the source-completeness policy.
   *
   * It deliberately carries no sidecar field any more. A database depending on
   * an absent `-wal` sidecar used to reach this state and be described as
   * "compatible, but it may not be complete" - which meant the flow's one
   * success state could represent a project silently missing the user's most
   * recent saved work. That is now a `failed` state with
   * `ARQ_WAL_SIDECAR_REQUIRED`, so reaching here means the bytes are whole.
   */
  | {
      readonly kind: 'native-opening';
      readonly name: string;
      /**
       * Whether the picked bytes are the whole database. Kept required even
       * though the completeness policy now refuses a dependent database before
       * this state - a caller that has not decided must not be able to omit the
       * answer and get the reassuring default, and that guarantee should not
       * rest on a refusal happening to run first somewhere else.
       */
      readonly sidecarDependency: ArqfsSidecarDependency;
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
    }
  /**
   * Everything below is the lifecycle after the byte-safe preflight gate that
   * `native-opening` represents. Before this existed the flow stopped at
   * "compatible Arq project" and the browser Worker was never constructed, so
   * there was no user-reachable way to open one.
   *
   * The order is fixed and each state means one specific thing has succeeded:
   * staging copied the selected bytes to a working location, migration was
   * verified on that copy, the Worker opened it, semantic hydration completed,
   * and only then is the workspace active.
   */
  | { readonly kind: 'staging'; readonly name: string; readonly fraction: number }
  | { readonly kind: 'staged'; readonly name: string; readonly projectId: string }
  | { readonly kind: 'migration-verified'; readonly name: string; readonly projectId: string }
  | {
      readonly kind: 'worker-open';
      readonly name: string;
      readonly projectId: string;
      /** Null when this project may be written; otherwise why it may not. */
      readonly readOnlyReason: ProjectReadOnlyReason | null;
    }
  | {
      readonly kind: 'hydrating';
      readonly name: string;
      readonly projectId: string;
      /** Decided once at Worker open and carried, never re-derived. */
      readonly readOnlyReason: ProjectReadOnlyReason | null;
    }
  | {
      readonly kind: 'workspace-active';
      readonly name: string;
      readonly projectId: string;
      readonly readOnlyReason: ProjectReadOnlyReason | null;
      /** What hydration read out of the project, so a surface names the project rather than the file. */
      readonly facts: OpenProjectFacts;
    }
  /**
   * A migration that failed leaves its half-migrated copy in place instead of
   * deleting it. That copy is the only evidence of a bug that corrupts projects
   * during upgrade, and the selected source file is untouched either way.
   */
  | {
      readonly kind: 'quarantined';
      readonly name: string;
      readonly quarantinePath: string;
      readonly lastKnownGood: LastKnownGoodProject | null;
    }
  | {
      readonly kind: 'cancelled';
      readonly name: string;
      /** Which stage the user cancelled, so the copy says what was undone. */
      readonly cancelledAt: 'staging' | 'migrating' | 'worker-open' | 'hydrating' | 'publishing';
      readonly lastKnownGood: LastKnownGoodProject | null;
    }
  | {
      readonly kind: 'project-failed';
      readonly name: string;
      readonly reason: ProjectOpenFailureReason;
      readonly detail: string;
      readonly lastKnownGood: LastKnownGoodProject | null;
    }
  | {
      readonly kind: 'recovery-available';
      readonly name: string;
      readonly projectId: string;
      readonly journalledOperations: number;
      readonly readOnlyReason: ProjectReadOnlyReason | null;
    }
  | {
      readonly kind: 'recovering';
      readonly name: string;
      readonly projectId: string;
      readonly readOnlyReason: ProjectReadOnlyReason | null;
    }
  | {
      readonly kind: 'publishing';
      readonly name: string;
      readonly projectId: string;
      readonly fraction: number;
      /**
       * Carried so publishing a read-only project cannot return as a writable
       * one, and so resuming restores the project the user actually had rather
       * than a fresh one that happens to share its id.
       */
      readonly readOnlyReason: ProjectReadOnlyReason | null;
      readonly facts: OpenProjectFacts;
    }
  /**
   * Portable bytes exist, and nothing may call them a published project yet.
   *
   * A successful write is not a successful publication: the file still has to be
   * reopened by a reader that shares nothing with the writer and found to hold
   * the same project, the same revision and the same semantic hash
   * (`publishProjectFile` in @arq/arqfs). Until that returns, the only honest
   * thing to say about the file on disk is that it is being checked. Collapsing
   * this into `published` is the publication equivalent of the false open this
   * flow already refuses.
   */
  | {
      readonly kind: 'publication-verifying';
      readonly name: string;
      readonly projectId: string;
      readonly readOnlyReason: ProjectReadOnlyReason | null;
      readonly facts: OpenProjectFacts;
    }
  /**
   * Verified. The revision and semantic hash are the fresh reader's own findings,
   * carried on the state so the copy can name the exact revision it proved rather
   * than the one the writer intended.
   */
  | {
      readonly kind: 'published';
      readonly name: string;
      readonly projectId: string;
      readonly readOnlyReason: ProjectReadOnlyReason | null;
      readonly facts: OpenProjectFacts;
      /**
       * The fresh reader's own findings. Deliberately separate from
       * `facts.revision`: that is the revision hydration read out of the working
       * project, and this is the revision an independent reader found in the
       * published file. They agree when publication succeeded, and keeping one
       * field would remove the ability to notice when they do not.
       */
      readonly revision: number;
      readonly semanticHash: string;
    }
  | { readonly kind: 'closed'; readonly lastKnownGood: LastKnownGoodProject | null };

export type FileFlowEvent =
  | { readonly type: 'acquire'; readonly name: string }
  | { readonly type: 'acquired' }
  /** Required, not optional: a caller that has not decided whether the file is complete must not be able to omit the answer and get the reassuring default. */
  | { readonly type: 'route-native'; readonly sidecarDependency: ArqfsSidecarDependency }
  | { readonly type: 'route-import'; readonly formatId: string }
  | { readonly type: 'import-start'; readonly requestId: string }
  | { readonly type: 'progress'; readonly fraction: number }
  | { readonly type: 'staged' }
  | { readonly type: 'safe-mode'; readonly reason: string }
  | { readonly type: 'fail'; readonly code: string; readonly message: string }
  | { readonly type: 'reset' }
  | { readonly type: 'stage-start' }
  | { readonly type: 'stage-progress'; readonly fraction: number }
  | { readonly type: 'stage-complete'; readonly projectId: string }
  | { readonly type: 'migration-verified' }
  | { readonly type: 'worker-opened'; readonly readOnlyReason: ProjectReadOnlyReason | null }
  /**
   * The open this build actually performs: the Worker holds the selected bytes
   * in memory and no working copy was ever staged. It skips staging and
   * migration because neither happened, and it cannot lie about that - there is
   * no writable form of this event, because a project with no working copy has
   * nowhere for a write to go (ADR-0028).
   */
  | { readonly type: 'open-in-place'; readonly projectId: string }
  | { readonly type: 'hydrate-start' }
  /** Hydration is where a project's own identity is first read, so it is where the facts enter the flow. */
  | { readonly type: 'hydrated'; readonly facts: OpenProjectFacts }
  | {
      readonly type: 'project-fail';
      readonly reason: ProjectOpenFailureReason;
      readonly detail: string;
    }
  | { readonly type: 'quarantine'; readonly quarantinePath: string }
  | { readonly type: 'cancel' }
  | { readonly type: 'recovery-found'; readonly journalledOperations: number }
  | { readonly type: 'recover-start' }
  | { readonly type: 'recovered' }
  | { readonly type: 'publish-start' }
  | { readonly type: 'publish-progress'; readonly fraction: number }
  /** The bytes are written and an independent reader is now checking them. */
  | { readonly type: 'publish-verify-start' }
  /**
   * Verification passed. The evidence is required on the event, not optional: a
   * caller that has not actually reopened and compared the file has nothing to
   * put here, and so cannot reach `published` by mistake.
   */
  | { readonly type: 'published'; readonly revision: number; readonly semanticHash: string }
  /** Back to editing after a publication, the project itself unchanged by it. */
  | { readonly type: 'resume-editing' }
  | { readonly type: 'close' };

/**
 * The single question every surface must ask before it renders a project as
 * open, and the reason this predicate exists rather than each caller testing
 * state kinds itself.
 *
 * Only `workspace-active` counts. Not `worker-open`, where the Worker has the
 * file but no semantic state has been hydrated, and not `hydrating`, where it
 * is partway through. A surface that treats either as open shows an editor over
 * a project that is not there yet, which is exactly the "no false open" rule.
 */
export function isProjectOpen(state: FileFlowState): boolean {
  return state.kind === 'workspace-active';
}

/**
 * Whether this state may accept a canonical mutation. Read-only files and every
 * in-progress or failed state answer no, so a caller cannot write into a
 * half-open project by checking only that something is loaded.
 */
export function isProjectWritable(state: FileFlowState): boolean {
  return state.kind === 'workspace-active' && state.readOnlyReason === null;
}

/**
 * The last fully active project, carried through whatever failed. Returns null
 * only when this session never had one.
 */
export function lastKnownGoodProject(state: FileFlowState): LastKnownGoodProject | null {
  // Publishing reads the working project; it never replaces or invalidates it. So
  // the project stays the last known good one throughout, and a publication that
  // fails still knows which project the user's changes are safe in. Leaving these
  // out made `project-failed` after a failed publish carry `lastKnownGood: null`,
  // which contradicted the very reassurance its copy gives.
  if (
    state.kind === 'workspace-active' ||
    state.kind === 'publishing' ||
    state.kind === 'publication-verifying' ||
    state.kind === 'published'
  ) {
    return { projectId: state.projectId, name: state.name };
  }
  if (
    state.kind === 'quarantined' ||
    state.kind === 'cancelled' ||
    state.kind === 'project-failed' ||
    state.kind === 'closed'
  ) {
    return state.lastKnownGood;
  }
  return null;
}

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
  if (state.kind === 'import-options' && event.type === 'import-start') {
    return { kind: 'importing', name: state.name, requestId: event.requestId, fraction: 0 };
  }
  if (state.kind === 'importing' && event.type === 'progress') {
    return { ...state, fraction: Math.max(0, Math.min(1, event.fraction)) };
  }
  if (state.kind === 'importing' && event.type === 'staged') {
    return { kind: 'staged-review', name: state.name, requestId: state.requestId };
  }

  // The lifecycle after preflight. Every transition below names both the state
  // it comes from and the event, so an event arriving out of order is ignored
  // rather than skipping a stage. Skipping is the dangerous direction: it is
  // how a project reaches "active" without having been hydrated.
  const carried = lastKnownGoodProject(state);

  if (event.type === 'project-fail' && 'name' in state && state.name !== undefined) {
    return {
      kind: 'project-failed',
      name: state.name,
      reason: event.reason,
      detail: event.detail,
      lastKnownGood: carried,
    };
  }
  if (event.type === 'cancel' && 'name' in state && state.name !== undefined) {
    const cancelledAt =
      state.kind === 'staging'
        ? 'staging'
        : state.kind === 'migrating'
          ? 'migrating'
          : state.kind === 'hydrating'
            ? 'hydrating'
            : state.kind === 'publishing'
              ? 'publishing'
              : state.kind === 'worker-open'
                ? 'worker-open'
                : null;
    // Only cancellable stages are cancellable. A cancel arriving in a state
    // with nothing in flight must not invent an undo that did not happen.
    //
    // `publication-verifying` is deliberately absent. By then a file exists on
    // disk whose soundness is precisely what is unknown, and cancelling would
    // leave the user holding it with no verdict attached. That resolves to
    // published or to a publication failure, never to "cancelled, nothing
    // changed" - which would be false about the file that is now there.
    if (cancelledAt !== null) {
      return { kind: 'cancelled', name: state.name, cancelledAt, lastKnownGood: carried };
    }
    return state;
  }
  if (event.type === 'close') {
    return { kind: 'closed', lastKnownGood: carried };
  }

  if (state.kind === 'native-opening' && event.type === 'stage-start') {
    return { kind: 'staging', name: state.name, fraction: 0 };
  }
  // The one legal way into the lifecycle without a staging copy, and the only
  // open this build performs. It starts from `native-opening` for the same
  // reason `stage-start` does - preflight cannot be skipped - and it lands
  // read-only for a reason no caller gets to choose: there is no working copy,
  // so there is nothing a write could be written to.
  if (state.kind === 'native-opening' && event.type === 'open-in-place') {
    return {
      kind: 'worker-open',
      name: state.name,
      projectId: event.projectId,
      readOnlyReason: 'build-cannot-write',
    };
  }
  if (state.kind === 'staging' && event.type === 'stage-progress') {
    return { ...state, fraction: Math.max(0, Math.min(1, event.fraction)) };
  }
  if (state.kind === 'staging' && event.type === 'stage-complete') {
    return { kind: 'staged', name: state.name, projectId: event.projectId };
  }
  if (state.kind === 'staged' && event.type === 'migration-verified') {
    return { kind: 'migration-verified', name: state.name, projectId: state.projectId };
  }
  if (state.kind === 'staged' && event.type === 'quarantine') {
    return {
      kind: 'quarantined',
      name: state.name,
      quarantinePath: event.quarantinePath,
      lastKnownGood: carried,
    };
  }
  if (state.kind === 'migration-verified' && event.type === 'worker-opened') {
    return {
      kind: 'worker-open',
      name: state.name,
      projectId: state.projectId,
      readOnlyReason: event.readOnlyReason,
    };
  }
  if (state.kind === 'worker-open' && event.type === 'recovery-found') {
    return {
      kind: 'recovery-available',
      name: state.name,
      projectId: state.projectId,
      journalledOperations: event.journalledOperations,
      readOnlyReason: state.readOnlyReason,
    };
  }
  if (state.kind === 'recovery-available' && event.type === 'recover-start') {
    return {
      kind: 'recovering',
      name: state.name,
      projectId: state.projectId,
      readOnlyReason: state.readOnlyReason,
    };
  }
  if (state.kind === 'recovering' && event.type === 'recovered') {
    // Recovery rejoins the normal path at hydration rather than jumping to
    // active: replayed operations still have to be hydrated and validated.
    return {
      kind: 'hydrating',
      name: state.name,
      projectId: state.projectId,
      readOnlyReason: state.readOnlyReason,
    };
  }
  if (state.kind === 'worker-open' && event.type === 'hydrate-start') {
    return {
      kind: 'hydrating',
      name: state.name,
      projectId: state.projectId,
      readOnlyReason: state.readOnlyReason,
    };
  }
  if (state.kind === 'hydrating' && event.type === 'hydrated') {
    return {
      kind: 'workspace-active',
      name: state.name,
      projectId: state.projectId,
      // A file opened read-only stays read-only through hydration. The answer
      // is decided once, at Worker open, and carried on the state itself rather
      // than recomputed somewhere it could drift optimistic.
      readOnlyReason: state.readOnlyReason,
      facts: event.facts,
    };
  }
  if (state.kind === 'workspace-active' && event.type === 'publish-start') {
    return {
      kind: 'publishing',
      name: state.name,
      projectId: state.projectId,
      fraction: 0,
      readOnlyReason: state.readOnlyReason,
      facts: state.facts,
    };
  }
  if (state.kind === 'publishing' && event.type === 'publish-progress') {
    return { ...state, fraction: Math.max(0, Math.min(1, event.fraction)) };
  }
  if (state.kind === 'publishing' && event.type === 'publish-verify-start') {
    return {
      kind: 'publication-verifying',
      name: state.name,
      projectId: state.projectId,
      readOnlyReason: state.readOnlyReason,
      facts: state.facts,
    };
  }
  // Only from `publication-verifying`. `publishing` deliberately has no route to
  // `published`: writing the bytes is the step that can succeed while producing an
  // unusable file, so it is exactly the step that must not be allowed to declare
  // success on its own.
  if (state.kind === 'publication-verifying' && event.type === 'published') {
    return {
      kind: 'published',
      name: state.name,
      projectId: state.projectId,
      readOnlyReason: state.readOnlyReason,
      facts: state.facts,
      revision: event.revision,
      semanticHash: event.semanticHash,
    };
  }
  // Publication is a read of the working project, so the project the user was
  // editing is still open and still exactly as it was. Without this the flow
  // dead-ended at `published` and the only way back to editing was reopening the
  // project the user already had.
  if (state.kind === 'published' && event.type === 'resume-editing') {
    return {
      kind: 'workspace-active',
      name: state.name,
      projectId: state.projectId,
      readOnlyReason: state.readOnlyReason,
      // The same facts hydration read, not re-read: publishing did not change
      // the working project, so re-deriving them would invite a different
      // answer for a project that did not move.
      facts: state.facts,
    };
  }

  return state;
}
