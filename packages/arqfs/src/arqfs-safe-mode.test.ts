import { describe, expect, it, afterEach } from 'vitest';
import { createNodeArqfsDriver } from './arqfs-node-driver';
import { createArqfsSchemaV1 } from './arqfs-schema';
import { putArchiveEntry } from './arqfs-archive-store';
import { buildArqfsRecoveryReport } from './arqfs-recovery-report';
import { resolveArqfsSafeModePlan } from './arqfs-safe-mode';
import type { ArqfsDriver } from './arqfs-driver';

function putRequiredEntries(driver: ArqfsDriver): void {
  putArchiveEntry(driver, 'manifest.json', new TextEncoder().encode('{}'));
  putArchiveEntry(driver, 'model.json', new TextEncoder().encode('{}'));
}

describe('resolveArqfsSafeModePlan', () => {
  let driver: ArqfsDriver;

  afterEach(() => {
    driver?.close();
  });

  it('is healthy and read-write for a fully populated, current-version file', () => {
    driver = createNodeArqfsDriver();
    createArqfsSchemaV1(driver);
    putRequiredEntries(driver);

    const plan = resolveArqfsSafeModePlan(buildArqfsRecoveryReport(driver));
    expect(plan).toEqual({
      canOpen: true,
      openReadOnly: false,
      missingRequiredEntries: [],
      reason: 'healthy',
    });
  });

  it('cannot open at all when the file is not a recognisable arqfs file', () => {
    driver = createNodeArqfsDriver();
    driver.exec('PRAGMA application_id = 12345');

    const plan = resolveArqfsSafeModePlan(buildArqfsRecoveryReport(driver));
    expect(plan.canOpen).toBe(false);
    expect(plan.openReadOnly).toBe(true);
  });

  it('opens read-only when required archive entries are missing, even though the file itself opens fine', () => {
    driver = createNodeArqfsDriver();
    createArqfsSchemaV1(driver);

    const plan = resolveArqfsSafeModePlan(buildArqfsRecoveryReport(driver));
    expect(plan).toEqual({
      canOpen: true,
      openReadOnly: true,
      missingRequiredEntries: ['manifest.json', 'model.json'],
      reason: 'missing required archive entries: manifest.json, model.json',
    });
  });

  it('opens read-only when the file itself reports safeModeRequired even with all required content present', () => {
    driver = createNodeArqfsDriver();
    createArqfsSchemaV1(driver);
    putRequiredEntries(driver);
    // Simulate a file from a reader whose major version this one cannot fully trust
    // to write, by directly manipulating the frozen header fields this test controls.
    driver.run("UPDATE arqfs_meta SET value = '2' WHERE key = 'min_writer_major'");

    const plan = resolveArqfsSafeModePlan(buildArqfsRecoveryReport(driver));
    expect(plan.canOpen).toBe(true);
    expect(plan.openReadOnly).toBe(true);
    expect(plan.reason).toContain('minWriterMajor');
  });
});
