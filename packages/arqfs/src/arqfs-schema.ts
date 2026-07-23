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

/** Matches contracts/arqfs.ts's ArqResourceDescriptor shape (reference-only; reproduced, not imported - see arqfs-header.ts). Chunk storage itself is ARQ-199. */
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

const CREATE_SCHEMA_MIGRATION_TABLE = `
  CREATE TABLE schema_migration (
    version INTEGER PRIMARY KEY,
    applied_at_unix_ms INTEGER NOT NULL
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
    driver.exec(CREATE_SCHEMA_MIGRATION_TABLE);

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
