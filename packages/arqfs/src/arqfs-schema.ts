import type { ArqfsDriver } from './arqfs-driver';
import { ARQ_APPLICATION_ID, ARQFS_CURRENT_FORMAT_VERSION } from './arqfs-header';

export const ARQFS_SCHEMA_VERSION = 1;

/**
 * `arqfs_meta`'s own two-column shape is permanently frozen across every future major
 * version - it is the one thing any version of Arq, however old or new, must always
 * be able to read to decide whether it can safely proceed with the rest of the file.
 * Everything else may change shape across a major version; this table does not.
 */
const CREATE_META_TABLE = `
  CREATE TABLE arqfs_meta (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  )
`;

/**
 * Stores @arq/project-format's existing logical archive entries (manifest.json,
 * model.json, operations.ndjson, views.json, sheets.json, checksums.json) as rows
 * instead of zip entries - see docs/architecture/ARQ-FILE-FORMAT.md's "Relationship
 * to the existing @arq/project-format archive". No content_sha256 column: checksum
 * integrity for these entries already comes from the checksums.json entry itself
 * (@arq/project-format/src/checksum.ts), not duplicated at this layer.
 */
const CREATE_ARCHIVE_ENTRY_TABLE = `
  CREATE TABLE archive_entry (
    path TEXT PRIMARY KEY,
    content BLOB NOT NULL,
    updated_at_unix_ms INTEGER NOT NULL
  )
`;

/** Matches contracts/arqfs.ts's ArqResourceDescriptor shape (reference-only; reproduced, not imported - see arqfs-header.ts). Chunk storage itself is resource_chunk, below (ARQ-199). */
const CREATE_RESOURCE_TABLE = `
  CREATE TABLE resource (
    sha256 TEXT PRIMARY KEY,
    media_type TEXT NOT NULL,
    canonical_role TEXT NOT NULL CHECK (
      canonical_role IN (
        'source-underlay',
        'source-import',
        'authoritative-geometry',
        'user-texture',
        'portable-preview'
      )
    ),
    byte_length INTEGER NOT NULL,
    chunk_size INTEGER NOT NULL,
    chunk_count INTEGER NOT NULL
  )
`;

/**
 * ARQ-199: content-addressed resource chunks. Each chunk carries its own sha256 so a
 * future resumable upload (ARQ-208) can verify/dedupe per chunk rather than only at
 * the whole-resource level. Ordered by (resource_sha256, chunk_index); a resource's
 * chunks are reassembled by reading them back in that order.
 */
const CREATE_RESOURCE_CHUNK_TABLE = `
  CREATE TABLE resource_chunk (
    resource_sha256 TEXT NOT NULL REFERENCES resource(sha256),
    chunk_index INTEGER NOT NULL,
    chunk_sha256 TEXT NOT NULL,
    content BLOB NOT NULL,
    PRIMARY KEY (resource_sha256, chunk_index)
  )
`;

const CREATE_SCHEMA_MIGRATION_TABLE = `
  CREATE TABLE schema_migration (
    version INTEGER PRIMARY KEY,
    applied_at_unix_ms INTEGER NOT NULL
  )
`;

/**
 * ARQ-198: working copy / linked document state - contracts/arqfs.ts's
 * ArqWorkingCopy shape, one row per project (enforced by the id=1 CHECK, since a
 * single arqfs file holds exactly one project's working-copy state). Separate from
 * arqfs_meta (which is permanently frozen for version bootstrapping) since this is
 * ordinary mutable application state, not format-version identification.
 */
const CREATE_WORKING_COPY_STATE_TABLE = `
  CREATE TABLE working_copy_state (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    project_id TEXT NOT NULL,
    local_revision INTEGER NOT NULL,
    server_revision INTEGER,
    linked_external_path TEXT,
    local_commit_state TEXT NOT NULL CHECK (local_commit_state IN ('clean', 'writing', 'failed')),
    sync_state TEXT NOT NULL CHECK (sync_state IN ('offline', 'syncing', 'synced', 'conflict')),
    publication_state TEXT NOT NULL CHECK (
      publication_state IN ('not-linked', 'current', 'pending', 'failed')
    )
  )
`;

/** Creates the v1 schema on a freshly opened, empty database. Not idempotent - callers must only call this once per new file (see arqfs-open.ts for opening an existing one). */
export function createArqfsSchemaV1(driver: ArqfsDriver): void {
  driver.exec(`PRAGMA application_id = ${ARQ_APPLICATION_ID}`);
  driver.exec(`PRAGMA user_version = ${ARQFS_SCHEMA_VERSION}`);

  driver.transaction(() => {
    driver.exec(CREATE_META_TABLE);
    driver.exec(CREATE_ARCHIVE_ENTRY_TABLE);
    driver.exec(CREATE_RESOURCE_TABLE);
    driver.exec(CREATE_RESOURCE_CHUNK_TABLE);
    driver.exec(CREATE_SCHEMA_MIGRATION_TABLE);
    driver.exec(CREATE_WORKING_COPY_STATE_TABLE);

    const insertMeta = 'INSERT INTO arqfs_meta (key, value) VALUES (?, ?)';
    driver.run(insertMeta, ['format_major', String(ARQFS_CURRENT_FORMAT_VERSION.major)]);
    driver.run(insertMeta, ['format_minor', String(ARQFS_CURRENT_FORMAT_VERSION.minor)]);
    driver.run(insertMeta, [
      'min_reader_major',
      String(ARQFS_CURRENT_FORMAT_VERSION.minReaderMajor),
    ]);
    driver.run(insertMeta, [
      'min_writer_major',
      String(ARQFS_CURRENT_FORMAT_VERSION.minWriterMajor),
    ]);

    driver.run('INSERT INTO schema_migration (version, applied_at_unix_ms) VALUES (?, ?)', [
      ARQFS_SCHEMA_VERSION,
      Date.now(),
    ]);
  });
}
