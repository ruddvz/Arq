import type { ArqfsDriver } from './arqfs-driver';
import { getArchiveEntry, putArchiveEntry, removeArchiveEntry } from './arqfs-archive-store';

/** Reproduces contracts/arqfs.ts's ArqWorkingCopy shape (reference-only; reproduced, not imported - see arqfs-header.ts). */
export interface ArqfsWorkingCopyState {
  readonly projectId: string;
  readonly localRevision: number;
  readonly serverRevision?: number;
  readonly linkedExternalPath?: string;
  readonly localCommitState: 'clean' | 'writing' | 'failed';
  readonly syncState: 'offline' | 'syncing' | 'synced' | 'conflict';
  readonly publicationState: 'not-linked' | 'current' | 'pending' | 'failed';
}

type WorkingCopyRow = {
  readonly project_id: string;
  readonly local_revision: number;
  readonly server_revision: number | null;
  readonly linked_external_path: string | null;
  readonly local_commit_state: string;
  readonly sync_state: string;
  readonly publication_state: string;
};

function rowToState(row: WorkingCopyRow): ArqfsWorkingCopyState {
  return {
    projectId: row.project_id,
    localRevision: row.local_revision,
    ...(row.server_revision !== null && { serverRevision: row.server_revision }),
    ...(row.linked_external_path !== null && { linkedExternalPath: row.linked_external_path }),
    localCommitState: row.local_commit_state as ArqfsWorkingCopyState['localCommitState'],
    syncState: row.sync_state as ArqfsWorkingCopyState['syncState'],
    publicationState: row.publication_state as ArqfsWorkingCopyState['publicationState'],
  };
}

/**
 * Initializes the (exactly one, per file) working-copy row. No sync epic exists yet
 * (ARQ-206 onward), so `syncState`/`publicationState` start at the only states that
 * are honest without one: 'offline' and 'not-linked' - not a guess at future sync
 * behaviour.
 */
export function initializeWorkingCopyState(driver: ArqfsDriver, projectId: string): void {
  driver.run(
    `INSERT INTO working_copy_state
       (id, project_id, local_revision, server_revision, linked_external_path, local_commit_state, sync_state, publication_state)
     VALUES (1, ?, 0, NULL, NULL, 'clean', 'offline', 'not-linked')`,
    [projectId],
  );
}

export function readWorkingCopyState(driver: ArqfsDriver): ArqfsWorkingCopyState | null {
  const rows = driver.query<WorkingCopyRow>('SELECT * FROM working_copy_state WHERE id = 1');
  const row = rows[0];
  return row ? rowToState(row) : null;
}

/** Marks a local write as in progress - the commit-order's "apply transaction" step (docs/architecture/PERSISTENCE-AND-RECOVERY.md) reflected at the canonical tier. */
export function beginLocalWrite(driver: ArqfsDriver): void {
  const result = driver.run(
    "UPDATE working_copy_state SET local_commit_state = 'writing' WHERE id = 1",
  );
  if (result.changes !== 1) {
    throw new Error('working copy state is not initialized');
  }
}

/** Marks a local write as committed and advances the local revision - the commit-order's "publish committed state" step. */
export function commitLocalWrite(driver: ArqfsDriver): void {
  const result = driver.run(
    "UPDATE working_copy_state SET local_commit_state = 'clean', local_revision = local_revision + 1 WHERE id = 1",
  );
  if (result.changes !== 1) {
    throw new Error('working copy state is not initialized');
  }
}

/** Marks a local write as failed without advancing the revision - the write did not complete, so nothing should look committed. */
export function failLocalWrite(driver: ArqfsDriver): void {
  const result = driver.run(
    "UPDATE working_copy_state SET local_commit_state = 'failed' WHERE id = 1",
  );
  if (result.changes !== 1) {
    throw new Error('working copy state is not initialized');
  }
}

export interface ArqfsLocalWriteContext {
  readonly previousRevision: number;
  readonly readArchiveEntry: (path: string) => Uint8Array | null;
  readonly putArchiveEntry: (path: string, content: Uint8Array) => void;
  readonly removeArchiveEntry: (path: string) => void;
}

export type ArqfsLocalWriteResult<T> =
  | { readonly status: 'committed'; readonly revision: number; readonly value: T }
  | { readonly status: 'rejected'; readonly previousRevision: number; readonly reason: string };

/**
 * Runs one canonical-file mutation with a durable write marker around the SQLite
 * transaction. The marker is intentionally set before the transaction starts: a
 * crash between the marker and SQLite BEGIN is detectable on the next open. A
 * successful transaction clears it and advances the revision atomically. A failed
 * transaction rolls its inner work back, then leaves `failed` for safe-mode UI to
 * explain rather than pretending the operation committed.
 */
export function runArqfsLocalWrite<T>(
  driver: ArqfsDriver,
  mutation: (context: ArqfsLocalWriteContext) => T,
): ArqfsLocalWriteResult<T> {
  const before = readWorkingCopyState(driver);
  if (before === null) {
    return {
      status: 'rejected',
      previousRevision: 0,
      reason: 'working copy state is not initialized',
    };
  }
  if (before.localCommitState === 'writing') {
    return {
      status: 'rejected',
      previousRevision: before.localRevision,
      reason: 'an interrupted local write requires recovery before another write',
    };
  }

  try {
    beginLocalWrite(driver);
    const value = driver.transaction(() => {
      const result = mutation({
        previousRevision: before.localRevision,
        readArchiveEntry: (path) => getArchiveEntry(driver, path),
        putArchiveEntry: (path, content) => putArchiveEntry(driver, path, content),
        removeArchiveEntry: (path) => removeArchiveEntry(driver, path),
      });
      commitLocalWrite(driver);
      const committed = readWorkingCopyState(driver);
      if (
        committed === null ||
        committed.localCommitState !== 'clean' ||
        committed.localRevision !== before.localRevision + 1
      ) {
        throw new Error('working copy commit invariant failed');
      }
      return result;
    });
    const after = readWorkingCopyState(driver);
    if (after === null || after.localCommitState !== 'clean') {
      return {
        status: 'rejected',
        previousRevision: before.localRevision,
        reason: 'working copy state could not be read after commit',
      };
    }
    return {
      status: 'committed',
      revision: after.localRevision,
      value,
    };
  } catch (error) {
    try {
      failLocalWrite(driver);
    } catch {
      // Preserve the original failure. A closed/read-only driver cannot record the
      // marker, but it must not make the caller believe the mutation succeeded.
    }
    return {
      status: 'rejected',
      previousRevision: before.localRevision,
      reason: error instanceof Error ? error.message : String(error),
    };
  }
}

/** Converts a marker left by a crash into an explicit failed state before retry. */
export function recoverInterruptedLocalWrite(driver: ArqfsDriver): ArqfsWorkingCopyState | null {
  const state = readWorkingCopyState(driver);
  if (state?.localCommitState === 'writing') {
    failLocalWrite(driver);
    return readWorkingCopyState(driver);
  }
  return state;
}
