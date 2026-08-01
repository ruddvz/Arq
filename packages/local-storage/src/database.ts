/**
 * ARQ-071: add Dexie project database.
 *
 * The local (offline-first) counterpart to database/schema.sql's
 * project_snapshot and project_operation tables - adapted for
 * IndexedDB: no file_object indirection (the snapshot blob is stored
 * directly, since there is no cloud object storage locally), and the
 * journal's sequence is IndexedDB's own auto-increment id rather than a
 * server-assigned bigint.
 *
 * This implements what docs/adr/0006-snapshots-and-local-journal.md
 * proposes (still "Proposed", not "Accepted" - see the Related ADR),
 * since that is what this issue explicitly asks to build; it does not
 * treat the ADR as formally ratified.
 *
 * The constructor accepts optional `indexedDB`/`IDBKeyRange`
 * implementations so tests can inject fake-indexeddb instead of relying
 * on a real browser - production callers omit them and Dexie uses the
 * real globals.
 */

import Dexie, { type Table } from 'dexie';

export interface LocalProjectSnapshotRecord {
  readonly id?: number;
  readonly projectId: string;
  readonly revision: number;
  readonly schemaVersion: number;
  readonly data: Uint8Array;
  readonly createdAt: string;
}

export interface LocalOperationJournalRecord {
  readonly id?: number;
  readonly projectId: string;
  readonly operationId: string;
  readonly actorId: string;
  readonly operationType: string;
  readonly baseRevision: number;
  readonly payload: unknown;
  readonly preconditions: unknown;
  readonly affectedElementIds: readonly string[];
  readonly createdAt: string;
}

/**
 * A regeneratable, non-authoritative cache entry (section 72: "Derived
 * caches may be discarded and regenerated") - e.g. a plan-render cache
 * or a computed room-area cache - kept in its own table, deliberately
 * separate from projectSnapshots/operationJournal (ARQ-146,
 * derived-cache.ts), so recovering from a corrupt cache entry can never
 * touch committed project data.
 */
export interface LocalDerivedCacheRecord {
  readonly id?: number;
  readonly projectId: string;
  readonly cacheKey: string;
  readonly data: Uint8Array;
  readonly sha256: string;
}

export interface LocalDatabaseOptions {
  readonly indexedDB?: IDBFactory;
  readonly IDBKeyRange?: typeof IDBKeyRange;
}

const DEFAULT_DATABASE_NAME = 'arq-local-db';

export class ArqLocalDatabase extends Dexie {
  projectSnapshots!: Table<LocalProjectSnapshotRecord, number>;
  operationJournal!: Table<LocalOperationJournalRecord, number>;
  derivedCaches!: Table<LocalDerivedCacheRecord, number>;

  constructor(databaseName: string = DEFAULT_DATABASE_NAME, options: LocalDatabaseOptions = {}) {
    super(databaseName, options);
    this.version(1).stores({
      projectSnapshots: '++id, projectId, revision, [projectId+revision]',
      operationJournal: '++id, projectId, operationId, [projectId+id]',
    });
    this.version(2).stores({
      derivedCaches: '++id, projectId, cacheKey, [projectId+cacheKey]',
    });
    /*
     * v3 adds a [projectId+operationId] index so an append can ask "have I
     * already recorded this operation?" as an indexed lookup rather than a
     * scan. Deliberately NOT a unique index: a database written by an earlier
     * build may already contain two rows sharing an operation id (ids were
     * derived from Date.now(), so two operations in the same millisecond over
     * the same elements collided), and a unique index would make that database
     * fail to upgrade - turning a recoverable journal into an unopenable one.
     * Uniqueness is enforced going forward by appendOperationRecord, inside a
     * transaction, where it can report a duplicate instead of throwing.
     */
    this.version(3).stores({
      operationJournal: '++id, projectId, operationId, [projectId+id], [projectId+operationId]',
    });
  }
}

export function createLocalDatabase(
  databaseName?: string,
  options?: LocalDatabaseOptions,
): ArqLocalDatabase {
  return new ArqLocalDatabase(databaseName, options);
}
