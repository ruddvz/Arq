import { describe, expect, it, afterEach } from 'vitest';
import { createNodeArqfsDriver } from './arqfs-node-driver';
import { createArqfsSchemaV1 } from './arqfs-schema';
import { putArchiveEntry } from './arqfs-archive-store';
import { buildArqfsRecoveryReport } from './arqfs-recovery-report';
import type { ArqfsDriver } from './arqfs-driver';

describe('buildArqfsRecoveryReport', () => {
  let driver: ArqfsDriver;

  afterEach(() => {
    driver?.close();
  });

  it('reports both required entries missing on a freshly created schema with no content yet', () => {
    driver = createNodeArqfsDriver();
    createArqfsSchemaV1(driver);

    const report = buildArqfsRecoveryReport(driver);

    expect(report.openResult.status).toBe('opened');
    expect(report.missingRequiredEntries).toEqual(['manifest.json', 'model.json']);
    expect(report.presentEntryCount).toBe(0);
  });

  it('reports no missing required entries once manifest.json and model.json are both present', () => {
    driver = createNodeArqfsDriver();
    createArqfsSchemaV1(driver);
    putArchiveEntry(driver, 'manifest.json', new TextEncoder().encode('{}'));
    putArchiveEntry(driver, 'model.json', new TextEncoder().encode('{}'));

    const report = buildArqfsRecoveryReport(driver);
    expect(report.missingRequiredEntries).toEqual([]);
    expect(report.presentEntryCount).toBe(2);
  });

  it('reports only the specific entry still missing, not both, once one is present', () => {
    driver = createNodeArqfsDriver();
    createArqfsSchemaV1(driver);
    putArchiveEntry(driver, 'manifest.json', new TextEncoder().encode('{}'));

    const report = buildArqfsRecoveryReport(driver);
    expect(report.missingRequiredEntries).toEqual(['model.json']);
  });

  it('carries the rejected open result through when the file is not a valid arqfs file at all', () => {
    driver = createNodeArqfsDriver();
    driver.exec('PRAGMA application_id = 12345');

    const report = buildArqfsRecoveryReport(driver);
    expect(report.openResult.status).toBe('rejected');
    expect(report.missingRequiredEntries).toEqual(['manifest.json', 'model.json']);
  });
});
