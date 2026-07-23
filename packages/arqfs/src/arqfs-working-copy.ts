import type { ArqfsDriver } from './arqfs-driver';

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
  driver.run("UPDATE working_copy_state SET local_commit_state = 'writing' WHERE id = 1");
}

/** Marks a local write as committed and advances the local revision - the commit-order's "publish committed state" step. */
export function commitLocalWrite(driver: ArqfsDriver): void {
  driver.run(
    "UPDATE working_copy_state SET local_commit_state = 'clean', local_revision = local_revision + 1 WHERE id = 1",
  );
}

/** Marks a local write as failed without advancing the revision - the write did not complete, so nothing should look committed. */
export function failLocalWrite(driver: ArqfsDriver): void {
  driver.run("UPDATE working_copy_state SET local_commit_state = 'failed' WHERE id = 1");
}
