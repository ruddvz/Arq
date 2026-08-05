/**
 * The step that was missing between "this file is safe to open" and a project
 * being open: the orchestrator that actually stages the selected bytes into an
 * ARQ-owned working project, opens them through the arqfs Worker, checks the
 * staged copy, hydrates it and only then reports `workspace-active`.
 *
 * Before this existed `packages/arqfs`, `workers/arqfs-worker` and the lifecycle
 * reducer were each complete and each had no path between them: `FileOpenPanel`
 * stopped at the preflight verdict, nothing in `apps/web` ever constructed the
 * Worker, and every lifecycle state after `native-opening` was unreachable. The
 * evidence for that was the `e2e_arq_open` check's own recorded limitation.
 *
 * Everything the browser supplies is injected rather than imported: Worker
 * construction, digesting and the clock. That is what lets the whole sequence -
 * including the refusal and cancellation paths, which are the ones worth
 * proving - run in Node against the same `handleArqfsWorkerRequest` the real
 * Worker runs, instead of only inside a headless browser check.
 */
import type { ArqfsWorkerRequestInput } from '@arq/arqfs/src/arqfs-worker-client';
import type { ArqfsWorkerResponsePayload } from '@arq/arqfs/src/arqfs-worker-protocol';
import type { ArqfsSidecarDependency } from '@arq/arqfs/src/arqfs-preflight';
import { ProjectOpenStateMachine, type ProjectOpenSnapshot } from '@arq/project-loading';
import type { FileFlowEvent, ProjectOpenFailureReason } from '../file-handling/file-state-machine';

/**
 * The archive entry every Arq project must carry for this build to hydrate a
 * semantic model from it. A file that opened, passed integrity and still has no
 * model is not a project this build can put a workspace over, and saying so here
 * is the difference between an empty editor and an honest refusal.
 */
export const REQUIRED_PROJECT_ENTRY = 'model.json';

/** One live connection to the Arq-owned Worker for a single project. */
export interface ProjectWorkerConnection {
  request(
    input: ArqfsWorkerRequestInput,
    options?: { readonly signal?: AbortSignal | undefined },
  ): Promise<ArqfsWorkerResponsePayload>;
  /** Always called, on every path out of the open - success, refusal or cancellation. */
  dispose(reason?: string): void;
}

export interface OpenNativeProjectDependencies {
  /**
   * Constructs the Worker and its client for this project id. Injected because
   * `new Worker(new URL(...))` is a browser-only construction whose failure mode
   * (a Worker that cannot be constructed at all) is one of the outcomes worth
   * testing.
   */
  readonly connect: (projectId: string) => Promise<ProjectWorkerConnection>;
  /** Emits into the lifecycle reducer. Every state change goes through here, in order. */
  readonly emit: (event: FileFlowEvent) => void;
  /** SHA-256 hex of the selected source bytes, kept as provenance for the working copy. */
  readonly digestSource: (bytes: Uint8Array) => Promise<string>;
}

export interface OpenNativeProjectInput {
  readonly projectId: string;
  /**
   * The selected source bytes. Never written to: they are copied into the
   * working project and the original file the user chose is left untouched, so a
   * failure anywhere below cannot damage what they picked.
   */
  readonly bytes: Uint8Array;
  readonly signal?: AbortSignal;
}

export type OpenNativeProjectOutcome =
  | {
      readonly kind: 'workspace-active';
      readonly projectId: string;
      readonly writable: boolean;
      readonly sourceDigest: string;
      readonly sidecarDependency: ArqfsSidecarDependency;
      readonly snapshot: ProjectOpenSnapshot;
      /** Held open for the session that now owns this project. */
      readonly connection: ProjectWorkerConnection;
    }
  | {
      readonly kind: 'failed';
      readonly reason: ProjectOpenFailureReason;
      readonly detail: string;
    }
  | { readonly kind: 'cancelled' };

class CancelledError extends Error {
  constructor() {
    super('open cancelled');
    this.name = 'CancelledError';
  }
}

class OpenFailure extends Error {
  readonly reason: ProjectOpenFailureReason;

  constructor(reason: ProjectOpenFailureReason, detail: string) {
    super(detail);
    this.name = 'OpenFailure';
    this.reason = reason;
  }
}

function describe(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * Opens a native `.arq` file the user selected, driving the lifecycle reducer
 * through every state it declares rather than jumping to the end.
 *
 * The order is the contract, and each step means one specific thing succeeded:
 * the bytes were copied into a working project this build owns, the copy passed
 * SQLite's own integrity check, the Worker's open accepted the file and decided
 * what this build may do with it, the required content is present, and a
 * semantic model was hydrated. `workspace-active` is emitted only after the
 * last of those, because it is the only state any surface may render as open.
 *
 * Nothing here mutates the caller's previously active project. A failure or a
 * cancellation returns without ever having emitted `hydrated`, so the reducer
 * carries the last known good project forward untouched - the working copy is
 * the only thing discarded.
 */
export async function openNativeProject(
  input: OpenNativeProjectInput,
  dependencies: OpenNativeProjectDependencies,
): Promise<OpenNativeProjectOutcome> {
  const { emit, connect, digestSource } = dependencies;
  const { projectId, bytes, signal } = input;

  // Stage 0 (Identify) is the byte preflight that already ran to route this file
  // here, so the attempt starts by recording it rather than re-deriving it.
  const stages = new ProjectOpenStateMachine(projectId);
  stages.start(0, 'Selected file routed as a native Arq project');
  stages.complete(0, 'Byte preflight accepted');

  let connection: ProjectWorkerConnection | null = null;
  const checkCancelled = (): void => {
    if (signal?.aborted === true) throw new CancelledError();
  };

  try {
    checkCancelled();
    emit({ type: 'stage-start' });

    // Provenance first, over the bytes as selected. Digesting after the copy
    // would describe the copy, which is not the thing the user chose and not
    // what a later "is this still the file you opened?" question is about.
    const sourceDigest = await digestSource(bytes);
    checkCancelled();
    emit({ type: 'stage-progress', fraction: 0.2 });

    stages.start(1, 'Connecting the project Worker');
    try {
      connection = await connect(projectId);
    } catch (error) {
      throw new OpenFailure('worker-failed', describe(error));
    }
    checkCancelled();
    emit({ type: 'stage-progress', fraction: 0.4 });

    // The copy. `importDatabase` refuses bytes that fail preflight and refuses
    // to run at all once this session has opened, so this is the only moment the
    // working project's contents can be established.
    let sidecarDependency: ArqfsSidecarDependency;
    try {
      const imported = await connection.request({ type: 'importDatabase', bytes }, { signal });
      if (imported.kind !== 'importDatabase') {
        throw new OpenFailure('worker-failed', `unexpected import response ${imported.kind}`);
      }
      if (imported.byteLength !== bytes.byteLength) {
        // The staged copy is not the length of what was handed over, so it is
        // not the file that was selected. Opening it would attach a workspace to
        // bytes nobody chose.
        throw new OpenFailure(
          'integrity-failed',
          `staged ${imported.byteLength} bytes for a ${bytes.byteLength}-byte source`,
        );
      }
      sidecarDependency = imported.sidecarDependency;
    } catch (error) {
      throw toOpenFailure(error, 'quota-exhausted', 'corrupt');
    }
    stages.complete(1, 'Source staged into the working project');
    checkCancelled();
    emit({ type: 'stage-progress', fraction: 0.6 });
    emit({ type: 'stage-complete', projectId });

    // The staged copy is checked before anything trusts it. This is the caller
    // `checkArqfsIntegrity` was written for and never had: a copy damaged in
    // transit reads as a perfectly ordinary database until something asks.
    stages.start(2, 'Verifying the staged working copy');
    const opened = await requestOpen(connection, signal);
    checkCancelled();
    const integrity = await connection.request({ type: 'checkIntegrity' }, { signal });
    if (integrity.kind !== 'checkIntegrity') {
      throw new OpenFailure('worker-failed', `unexpected integrity response ${integrity.kind}`);
    }
    if (!integrity.report.ok) {
      throw new OpenFailure(
        'integrity-failed',
        integrity.report.quickCheck.join('; ') ||
          `${integrity.report.foreignKeyViolations.length} foreign-key violations`,
      );
    }
    stages.complete(2, 'Working copy passed SQLite integrity checks');
    // No migration ran: this build opened the file at its own schema. The state
    // is still emitted, because the lifecycle requires migration to have been
    // decided one way or the other before a Worker open counts.
    emit({ type: 'migration-verified' });
    emit({ type: 'worker-opened', writable: opened.writable });

    stages.start(3, 'Hydrating the semantic model');
    emit({ type: 'hydrate-start' });
    const paths = await connection.request({ type: 'listArchiveEntryPaths' }, { signal });
    if (paths.kind !== 'listArchiveEntryPaths') {
      throw new OpenFailure('hydration-failed', `unexpected entry-list response ${paths.kind}`);
    }
    if (!paths.paths.includes(REQUIRED_PROJECT_ENTRY)) {
      throw new OpenFailure(
        'hydration-failed',
        `the project has no ${REQUIRED_PROJECT_ENTRY} to hydrate from`,
      );
    }
    const model = await connection.request(
      { type: 'getArchiveEntry', path: REQUIRED_PROJECT_ENTRY },
      { signal },
    );
    if (model.kind !== 'getArchiveEntry' || model.content === null) {
      throw new OpenFailure(
        'hydration-failed',
        `${REQUIRED_PROJECT_ENTRY} was listed but could not be read`,
      );
    }
    checkCancelled();
    stages.complete(3, 'Semantic model hydrated');

    // Only now. Every earlier state means a stage succeeded; this one means the
    // project is genuinely there to be edited.
    emit({ type: 'hydrated' });
    return {
      kind: 'workspace-active',
      projectId,
      writable: opened.writable,
      sourceDigest,
      sidecarDependency,
      snapshot: stages.snapshot(),
      connection,
    };
  } catch (error) {
    // One exit for every failure path, so releasing the Worker cannot be
    // forgotten on the branch nobody tested. A Worker left alive holds an
    // exclusive OPFS handle on the project file, and the next attempt to open
    // that project would block behind it.
    connection?.dispose(
      error instanceof CancelledError ? 'project open cancelled' : 'project open failed',
    );
    if (error instanceof CancelledError) {
      emit({ type: 'cancel' });
      return { kind: 'cancelled' };
    }
    const failure =
      error instanceof OpenFailure ? error : new OpenFailure('worker-failed', describe(error));
    emit({ type: 'project-fail', reason: failure.reason, detail: failure.message });
    return { kind: 'failed', reason: failure.reason, detail: failure.message };
  }
}

/**
 * The Worker's own open decision, translated into the lifecycle's vocabulary.
 *
 * A file this build may read but not write is not a failure - it is a read-only
 * project, and the flow carries `writable: false` all the way to
 * `workspace-active`. A file it may not read at all is, because there is nothing
 * to put a workspace over.
 */
async function requestOpen(
  connection: ProjectWorkerConnection,
  signal: AbortSignal | undefined,
): Promise<{ readonly writable: boolean }> {
  let payload: ArqfsWorkerResponsePayload;
  try {
    payload = await connection.request({ type: 'open' }, { signal });
  } catch (error) {
    throw toOpenFailure(error, 'worker-failed', 'worker-failed');
  }
  if (payload.kind !== 'open') {
    throw new OpenFailure('worker-failed', `unexpected open response ${payload.kind}`);
  }
  const { result } = payload;
  if (result.status === 'rejected') {
    throw new OpenFailure('invalid-header', result.reason);
  }
  if (!result.capabilities.canRead) {
    throw new OpenFailure(
      'unsupported-version',
      result.capabilities.unsupportedRequiredFeatures.join(', ') ||
        'this build cannot read this file',
    );
  }
  if (result.capabilities.safeModeRequired) {
    throw new OpenFailure(
      'unsupported-capability',
      result.capabilities.unsupportedRequiredFeatures.join(', ') || 'this file requires safe mode',
    );
  }
  return { writable: result.capabilities.canWrite };
}

/**
 * Keeps a cancellation a cancellation. `AbortSignal` surfaces as a rejected
 * request inside the Worker client, and reporting that as a failure would tell
 * the user their project was damaged when they are the one who stopped it.
 */
function toOpenFailure(
  error: unknown,
  quotaReason: ProjectOpenFailureReason,
  defaultReason: ProjectOpenFailureReason,
): Error {
  if (error instanceof CancelledError || error instanceof OpenFailure) return error;
  if (error instanceof DOMException && error.name === 'AbortError') return new CancelledError();
  const detail = describe(error);
  if (/quota|storage|space/i.test(detail)) return new OpenFailure(quotaReason, detail);
  return new OpenFailure(defaultReason, detail);
}
