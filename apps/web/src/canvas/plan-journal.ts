import {
  appendOperationRecord,
  createLocalDatabase,
  onAbnormalClose,
  readJournalSince,
  type ArqLocalDatabase,
  type LocalDatabaseOptions,
} from '@arq/local-storage';
import { applyOperation, type DrawnWall, type WorkspaceOperation } from './plan-document';

/**
 * Real local persistence for the plan document: every committed geometry
 * operation (add/remove walls - not 'note' actions, which are not project
 * state) is appended to @arq/local-storage's IndexedDB operation journal,
 * and start-up replays the journal to recover the document. This is the
 * ADR-0006 journal pattern applied to the workspace's honest scope: the
 * demo project's edits now genuinely survive reload and crash, while
 * .arq-file persistence remains the open-project pipeline's job
 * (see STATUS.md).
 *
 * Undo and redo append the operation they applied (the inverse or the
 * replayed forward op) rather than rewriting history - the journal is an
 * append-only log, and replaying it start-to-end reproduces the final
 * state exactly.
 *
 * No snapshot/prune policy runs here yet: at workspace-demo scale the
 * journal is tiny, and snapshot cadence (shouldTakeSnapshot) belongs with
 * the open-project pipeline where real project sizes exist.
 */

export const PLAN_JOURNAL_ACTOR = 'local-user';

/**
 * A journal-unique operation id.
 *
 * The previous scheme was `${kind}-${affectedIds}-${Date.now()}`, which is not
 * unique: two operations of the same kind over the same walls within one
 * millisecond - rapid undo then redo, or a repeated delete - produced the same
 * id. That matters now that the append is idempotent per id, because a genuine
 * second operation carrying a previously-used id would be silently discarded as
 * a duplicate. A counter plus a per-session token is unique without depending on
 * the clock's resolution or on it moving forwards.
 */
let operationCounter = 0;
const sessionToken = Math.random().toString(36).slice(2, 10);

function nextOperationId(kind: string): string {
  operationCounter += 1;
  return `${kind}-${sessionToken}-${operationCounter}`;
}

export type PlanJournalState =
  | { readonly status: 'ready' }
  | { readonly status: 'unavailable'; readonly reason: string }
  | { readonly status: 'write-failed'; readonly reason: string };

export interface PlanJournal {
  /** Replays the journal for `projectId`, returning the recovered document. */
  recover(projectId: string): Promise<{
    readonly walls: readonly DrawnWall[];
    readonly recoveredOperationCount: number;
  }>;
  /** Appends one applied operation; resolves to the journal's health after the write. */
  append(projectId: string, operation: WorkspaceOperation): Promise<PlanJournalState>;
  /** Fires when the browser abnormally closes the database (eviction, deletion). */
  onUnavailable(listener: (state: PlanJournalState) => void): () => void;
  close(): void;
}

export function createPlanJournal(
  databaseName?: string,
  options?: LocalDatabaseOptions,
): PlanJournal {
  let db: ArqLocalDatabase;
  try {
    db = createLocalDatabase(databaseName, options);
  } catch (error) {
    return unavailableJournal(describeError(error));
  }

  return {
    async recover(projectId) {
      const entries = await readJournalSince(db, projectId, 0);
      let walls: readonly DrawnWall[] = [];
      let replayed = 0;
      for (const entry of entries) {
        // Only geometry operations are journaled, but the log is still
        // external input on the way back in: an unrecognised payload is
        // skipped rather than crashing recovery.
        const operation = entry.payload as WorkspaceOperation;
        if (operation.kind === 'add-walls' || operation.kind === 'remove-walls') {
          walls = applyOperation(walls, operation);
          replayed += 1;
        }
      }
      return { walls, recoveredOperationCount: replayed };
    },

    async append(projectId, operation) {
      if (operation.kind === 'note') {
        return { status: 'ready' };
      }
      const affected =
        operation.kind === 'add-walls' ? operation.walls.map((wall) => wall.id) : operation.wallIds;
      const result = await appendOperationRecord(db, {
        projectId,
        operationId: nextOperationId(operation.kind),
        actorId: PLAN_JOURNAL_ACTOR,
        operationType: operation.kind,
        baseRevision: 0,
        payload: operation,
        preconditions: null,
        affectedElementIds: affected,
        createdAt: new Date().toISOString(),
      });
      // A duplicate means this exact operation was already recorded, which is
      // the successful outcome of a retry, not a failure.
      if (result.status === 'appended' || result.status === 'duplicate') {
        return { status: 'ready' };
      }
      if (result.status === 'quota-exceeded') {
        return {
          status: 'write-failed',
          reason:
            'The browser refused more local storage (quota exceeded). Your change is applied but not journalled; free space or export your work.',
        };
      }
      return { status: 'write-failed', reason: describeError(result.error) };
    },

    onUnavailable(listener) {
      return onAbnormalClose(db, () =>
        listener({
          status: 'unavailable',
          reason:
            'The browser closed local storage (evicted or deleted). New changes are not being journalled.',
        }),
      );
    },

    close() {
      db.close();
    },
  };
}

function unavailableJournal(reason: string): PlanJournal {
  return {
    recover: () => Promise.resolve({ walls: [], recoveredOperationCount: 0 }),
    append: () => Promise.resolve({ status: 'unavailable', reason }),
    onUnavailable: () => () => undefined,
    close: () => undefined,
  };
}

function describeError(error: unknown): string {
  return error instanceof Error ? `${error.name}: ${error.message}` : String(error);
}
