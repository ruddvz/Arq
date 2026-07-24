import { describe, expect, it, afterEach } from 'vitest';
import { createNodeArqfsDriver } from './arqfs-node-driver';
import { createArqfsSchemaV1 } from './arqfs-schema';
import { createArqfsSchemaLatest } from './arqfs-schema-v2';
import { openArqfs, evaluateOpenCapabilities } from './arqfs-open';
import { ARQFS_CURRENT_FORMAT_VERSION, type ArqFormatVersion } from './arqfs-header';
import type { ArqfsDriver } from './arqfs-driver';

describe('openArqfs', () => {
  let driver: ArqfsDriver;

  afterEach(() => {
    driver?.close();
  });

  it('opens a freshly created v1 database and reports a migration is available to the current (v2) reader', () => {
    driver = createNodeArqfsDriver();
    createArqfsSchemaV1(driver);

    const result = openArqfs(driver);

    expect(result).toEqual({
      status: 'opened',
      header: { major: 1, minor: 0, schema: 1, minReaderMajor: 1, minWriterMajor: 1 },
      capabilities: {
        canRead: true,
        canWrite: true,
        canMigrate: true,
        safeModeRequired: false,
        unsupportedRequiredFeatures: [],
      },
    });
  });

  it('opens a freshly created latest-schema database with full capabilities and nothing to migrate', () => {
    driver = createNodeArqfsDriver();
    createArqfsSchemaLatest(driver, createArqfsSchemaV1);

    const result = openArqfs(driver);

    expect(result).toEqual({
      status: 'opened',
      header: { major: 1, minor: 0, schema: 2, minReaderMajor: 1, minWriterMajor: 1 },
      capabilities: {
        canRead: true,
        canWrite: true,
        canMigrate: false,
        safeModeRequired: false,
        unsupportedRequiredFeatures: [],
      },
    });
  });

  it('rejects a database with the wrong application ID rather than throwing', () => {
    driver = createNodeArqfsDriver();
    driver.exec('PRAGMA application_id = 12345');
    driver.exec('CREATE TABLE arqfs_meta (key TEXT PRIMARY KEY, value TEXT NOT NULL)');

    const result = openArqfs(driver);
    expect(result).toEqual({
      status: 'rejected',
      reason: expect.stringContaining('application_id'),
    });
  });

  it('rejects a database missing arqfs_meta entirely rather than throwing', () => {
    driver = createNodeArqfsDriver();
    driver.exec('PRAGMA application_id = 1094861617');

    const result = openArqfs(driver);
    expect(result.status).toBe('rejected');
  });

  it('rejects arqfs_meta rows with non-numeric version fields rather than throwing', () => {
    driver = createNodeArqfsDriver();
    createArqfsSchemaV1(driver);
    driver.run("UPDATE arqfs_meta SET value = 'not-a-number' WHERE key = 'format_major'");

    const result = openArqfs(driver);
    expect(result).toEqual({ status: 'rejected', reason: expect.stringContaining('non-numeric') });
  });
});

describe('evaluateOpenCapabilities', () => {
  const v1: ArqFormatVersion = {
    major: 1,
    minor: 0,
    schema: 1,
    minReaderMajor: 1,
    minWriterMajor: 1,
  };

  it('grants full capabilities when file and reader versions match exactly', () => {
    expect(
      evaluateOpenCapabilities(ARQFS_CURRENT_FORMAT_VERSION, ARQFS_CURRENT_FORMAT_VERSION),
    ).toEqual({
      canRead: true,
      canWrite: true,
      canMigrate: false,
      safeModeRequired: false,
      unsupportedRequiredFeatures: [],
    });
  });

  it('refuses to open at all when the reader major is below the file minReaderMajor', () => {
    const futureFile: ArqFormatVersion = {
      major: 3,
      minor: 0,
      schema: 3,
      minReaderMajor: 3,
      minWriterMajor: 3,
    };
    const capabilities = evaluateOpenCapabilities(futureFile, v1);

    expect(capabilities.canRead).toBe(false);
    expect(capabilities.canWrite).toBe(false);
    expect(capabilities.safeModeRequired).toBe(true);
    expect(capabilities.unsupportedRequiredFeatures).toContain('format-major-too-new-for-reader');
  });

  it('allows read but refuses write when the reader major is below minWriterMajor but above minReaderMajor', () => {
    const file: ArqFormatVersion = {
      major: 2,
      minor: 0,
      schema: 2,
      minReaderMajor: 1,
      minWriterMajor: 2,
    };
    const readerV1: ArqFormatVersion = {
      major: 1,
      minor: 0,
      schema: 1,
      minReaderMajor: 1,
      minWriterMajor: 1,
    };

    const capabilities = evaluateOpenCapabilities(file, readerV1);
    expect(capabilities.canRead).toBe(true);
    expect(capabilities.canWrite).toBe(false);
    expect(capabilities.safeModeRequired).toBe(false);
  });

  it('reports canMigrate when the file schema is older than the reader schema', () => {
    const olderFile: ArqFormatVersion = {
      major: 1,
      minor: 0,
      schema: 1,
      minReaderMajor: 1,
      minWriterMajor: 1,
    };
    const newerReader: ArqFormatVersion = {
      major: 1,
      minor: 0,
      schema: 2,
      minReaderMajor: 1,
      minWriterMajor: 1,
    };

    expect(evaluateOpenCapabilities(olderFile, newerReader).canMigrate).toBe(true);
  });
});
