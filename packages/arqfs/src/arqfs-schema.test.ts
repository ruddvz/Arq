import { describe, expect, it, afterEach } from 'vitest';
import { createNodeArqfsDriver } from './arqfs-node-driver';
import { createArqfsSchemaV1, ARQFS_SCHEMA_VERSION } from './arqfs-schema';
import { ARQ_APPLICATION_ID } from './arqfs-header';
import type { ArqfsDriver } from './arqfs-driver';

describe('createArqfsSchemaV1', () => {
  let driver: ArqfsDriver;

  afterEach(() => {
    driver?.close();
  });

  it('sets the reserved application ID and schema version as native SQLite pragmas', () => {
    driver = createNodeArqfsDriver();
    createArqfsSchemaV1(driver);

    expect(driver.pragma('application_id')).toBe(ARQ_APPLICATION_ID);
    expect(driver.pragma('user_version')).toBe(ARQFS_SCHEMA_VERSION);
  });

  it('creates all seven v1 tables', () => {
    driver = createNodeArqfsDriver();
    createArqfsSchemaV1(driver);

    const tables = driver
      .query<{ readonly name: string }>("SELECT name FROM sqlite_master WHERE type = 'table'")
      .map((row) => row.name)
      .sort();

    expect(tables).toEqual([
      'archive_entry',
      'arqfs_meta',
      'feature_flag',
      'resource',
      'resource_chunk',
      'schema_migration',
      'working_copy_state',
    ]);
  });

  it('records the frozen v1 header fields in arqfs_meta', () => {
    driver = createNodeArqfsDriver();
    createArqfsSchemaV1(driver);

    const meta = new Map(
      driver
        .query<{ readonly key: string; readonly value: string }>(
          'SELECT key, value FROM arqfs_meta',
        )
        .map((row) => [row.key, row.value]),
    );

    expect(meta.get('format_major')).toBe('1');
    expect(meta.get('format_minor')).toBe('0');
    expect(meta.get('min_reader_major')).toBe('1');
    expect(meta.get('min_writer_major')).toBe('1');
  });

  it('records a schema_migration row for the version it just created', () => {
    driver = createNodeArqfsDriver();
    createArqfsSchemaV1(driver);

    const rows = driver.query<{ readonly version: number }>('SELECT version FROM schema_migration');
    expect(rows).toEqual([{ version: ARQFS_SCHEMA_VERSION }]);
  });

  it('enforces the resource table canonical_role check constraint', () => {
    driver = createNodeArqfsDriver();
    createArqfsSchemaV1(driver);

    expect(() =>
      driver.run(
        'INSERT INTO resource (sha256, media_type, canonical_role, byte_length, chunk_size, chunk_count) VALUES (?, ?, ?, ?, ?, ?)',
        ['abc123', 'image/png', 'not-a-real-role', 100, 100, 1],
      ),
    ).toThrow();

    expect(() =>
      driver.run(
        'INSERT INTO resource (sha256, media_type, canonical_role, byte_length, chunk_size, chunk_count) VALUES (?, ?, ?, ?, ?, ?)',
        ['abc123', 'image/png', 'user-texture', 100, 100, 1],
      ),
    ).not.toThrow();
  });
});
