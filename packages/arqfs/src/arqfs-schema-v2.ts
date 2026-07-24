import type { ArqfsDriver } from './arqfs-driver';
import {
  migrateArqfsCopyOnWrite,
  type ArqfsMigrationOptions,
  type ArqfsMigrationResult,
} from './arqfs-migration';

/**
 * ARQ-238-adjacent: schema v2 adds provenance/import tracking on top of the
 * v1 schema (arqfs-schema.ts) - source documents, their object-level mapping
 * onto Arq elements, import-session state, per-session issues, and a
 * resource-ownership index. Deliberately does not add a second "which
 * capabilities does this reader understand" mechanism here: that already
 * exists as arqfs-feature-flags.ts's `feature_flag` table/
 * `unsupportedRequiredFeatures` (ARQ-221) - `openArqfs` (arqfs-open.ts)
 * already evaluates it for every schema version, v2 included, so a schema-v2
 * file that needs a new required feature just calls the existing
 * `declareFeatureFlag`/adds a name to `KNOWN_FEATURE_NAMES`, with nothing new
 * to build here.
 *
 * FP-004: `migrateArqfsSchemaV1ToV2` below operates directly on whatever driver
 * it is handed, inside one transaction - correct and safe only if that driver is
 * always a throwaway copy, never a caller's only real file. This module never
 * enforces that itself; use `migrateArqfsSchemaV1ToV2ViaCopy` (composes this
 * transform with arqfs-migration.ts's copy-on-write helper) rather than calling
 * `migrateArqfsSchemaV1ToV2` against a driver you don't already know is a copy.
 */
export const ARQFS_SCHEMA_VERSION_V2 = 2;

const STATEMENTS = [
  `CREATE TABLE source_document (
    id TEXT PRIMARY KEY,
    original_name TEXT NOT NULL,
    media_type TEXT,
    detected_format TEXT NOT NULL,
    sha256 TEXT NOT NULL CHECK (length(sha256) = 64),
    byte_length INTEGER NOT NULL CHECK (byte_length >= 0),
    imported_at_unix_ms INTEGER NOT NULL,
    adapter_id TEXT NOT NULL,
    adapter_version TEXT NOT NULL,
    fidelity TEXT NOT NULL CHECK (
      fidelity IN ('native', 'exact', 'structured', 'approximated', 'underlay', 'attached', 'rejected')
    ),
    source_resource_sha256 TEXT REFERENCES resource(sha256),
    source_uri_hint TEXT,
    UNIQUE (sha256, original_name)
  )`,
  `CREATE TABLE source_object_map (
    source_document_id TEXT NOT NULL REFERENCES source_document(id) ON DELETE CASCADE,
    source_object_id TEXT NOT NULL,
    arq_element_id TEXT,
    mapping_kind TEXT NOT NULL CHECK (
      mapping_kind IN ('exact', 'transformed', 'approximated', 'attached', 'ignored')
    ),
    confidence REAL CHECK (confidence IS NULL OR (confidence >= 0 AND confidence <= 1)),
    notes TEXT,
    PRIMARY KEY (source_document_id, source_object_id, arq_element_id)
  )`,
  `CREATE TABLE import_session (
    id TEXT PRIMARY KEY,
    source_document_id TEXT REFERENCES source_document(id),
    status TEXT NOT NULL CHECK (
      status IN ('queued', 'detecting', 'converting', 'validating', 'staged', 'committed', 'cancelled', 'failed')
    ),
    started_at_unix_ms INTEGER NOT NULL,
    finished_at_unix_ms INTEGER,
    source_name TEXT NOT NULL,
    source_sha256 TEXT NOT NULL CHECK (length(source_sha256) = 64),
    detected_format TEXT NOT NULL,
    adapter_id TEXT,
    policy_json TEXT NOT NULL,
    report_json TEXT,
    failure_code TEXT,
    failure_message TEXT
  )`,
  `CREATE TABLE import_issue (
    import_session_id TEXT NOT NULL REFERENCES import_session(id) ON DELETE CASCADE,
    issue_index INTEGER NOT NULL CHECK (issue_index >= 0),
    severity TEXT NOT NULL CHECK (severity IN ('info', 'warning', 'error', 'fatal')),
    code TEXT NOT NULL,
    message TEXT NOT NULL,
    source_object_id TEXT,
    PRIMARY KEY (import_session_id, issue_index)
  )`,
  `CREATE TABLE resource_reference (
    resource_sha256 TEXT NOT NULL REFERENCES resource(sha256) ON DELETE CASCADE,
    owner_kind TEXT NOT NULL CHECK (
      owner_kind IN ('source-document', 'model-element', 'view', 'sheet', 'preview', 'import-session')
    ),
    owner_id TEXT NOT NULL,
    role TEXT NOT NULL,
    PRIMARY KEY (resource_sha256, owner_kind, owner_id, role)
  )`,
  `CREATE INDEX idx_source_document_sha256 ON source_document(sha256)`,
  `CREATE INDEX idx_source_object_map_arq_element ON source_object_map(arq_element_id)`,
  `CREATE INDEX idx_import_session_status ON import_session(status)`,
  `CREATE INDEX idx_import_issue_severity ON import_issue(severity)`,
  `CREATE INDEX idx_resource_reference_owner ON resource_reference(owner_kind, owner_id)`,
] as const;

export type ArqfsSchemaMigrationResult =
  | { readonly status: 'migrated'; readonly from: 1; readonly to: 2 }
  | { readonly status: 'already-current'; readonly version: 2 }
  | { readonly status: 'rejected'; readonly reason: string };

export function migrateArqfsSchemaV1ToV2(
  driver: ArqfsDriver,
  nowUnixMs: number = Date.now(),
): ArqfsSchemaMigrationResult {
  const current = driver.pragma('user_version');
  if (current === ARQFS_SCHEMA_VERSION_V2) return { status: 'already-current', version: 2 };
  if (current !== 1)
    return { status: 'rejected', reason: `expected schema 1, found ${String(current)}` };

  try {
    driver.transaction(() => {
      // Not `PRAGMA foreign_keys = ON` here: SQLite makes that pragma a no-op
      // inside a transaction (it may only be toggled with no pending BEGIN),
      // so enabling it here would silently do nothing. Enforcement is a
      // connection-level concern - see arqfs-defensive-open.ts, which every
      // real open path already runs through.
      for (const statement of STATEMENTS) driver.exec(statement);
      driver.run('INSERT INTO schema_migration (version, applied_at_unix_ms) VALUES (?, ?)', [
        ARQFS_SCHEMA_VERSION_V2,
        nowUnixMs,
      ]);
      driver.exec(`PRAGMA user_version = ${ARQFS_SCHEMA_VERSION_V2}`);
    });
    return { status: 'migrated', from: 1, to: 2 };
  } catch (error) {
    return {
      status: 'rejected',
      reason: error instanceof Error ? error.message : String(error),
    };
  }
}

export function createArqfsSchemaLatest(
  driver: ArqfsDriver,
  createV1: (driver: ArqfsDriver) => void,
): void {
  createV1(driver);
  const result = migrateArqfsSchemaV1ToV2(driver);
  if (result.status === 'rejected')
    throw new Error(`Could not create latest Arq schema: ${result.reason}`);
}

/**
 * FP-004: the safe way to run this migration against a real file. Composes
 * arqfs-migration.ts's `migrateArqfsCopyOnWrite` (VACUUM INTO a fresh target,
 * transform that copy, verify it reopens cleanly - the source is only ever read
 * from) with this module's own v1-to-v2 transform, so a caller never has to
 * hand-assemble the two pieces correctly themselves.
 */
export function migrateArqfsSchemaV1ToV2ViaCopy(
  sourceDriver: ArqfsDriver,
  targetPath: string,
  openDriver: (path: string) => ArqfsDriver,
  options: ArqfsMigrationOptions = {},
): ArqfsMigrationResult {
  return migrateArqfsCopyOnWrite(
    sourceDriver,
    targetPath,
    openDriver,
    (target) => {
      const result = migrateArqfsSchemaV1ToV2(target);
      if (result.status !== 'migrated') {
        throw new Error(
          result.status === 'already-current'
            ? 'target copy is already at schema v2'
            : result.reason,
        );
      }
    },
    options,
  );
}
