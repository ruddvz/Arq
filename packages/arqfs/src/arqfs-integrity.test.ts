import { describe, expect, it, afterEach } from 'vitest';
import { createNodeArqfsDriver } from './arqfs-node-driver';
import { createArqfsSchemaV1 } from './arqfs-schema';
import { createArqfsSchemaLatest } from './arqfs-schema-v2';
import { checkArqfsIntegrity } from './arqfs-integrity';
import type { ArqfsDriver } from './arqfs-driver';

describe('arqfs-integrity', () => {
  let driver: ArqfsDriver;

  afterEach(() => {
    driver?.close();
  });

  /**
   * Regression guard. `PRAGMA quick_check` names its result column after the pragma
   * (`quick_check`), not `integrity_check`. Reading a fixed column name yielded
   * `undefined` on every row, so a perfectly healthy file reported `ok: false` and
   * every caller that trusted it - migration accept/reject and the safe-mode plan -
   * inherited the wrong answer. A healthy file must assert `ok: true` explicitly,
   * otherwise the failure mode is invisible again.
   */
  it('reports a healthy file as ok with a single "ok" quick-check row', () => {
    driver = createNodeArqfsDriver();
    createArqfsSchemaV1(driver);

    expect(checkArqfsIntegrity(driver)).toEqual({
      ok: true,
      quickCheck: ['ok'],
      foreignKeyViolations: [],
    });
  });

  it('reports ok for a schema v2 file too', () => {
    driver = createNodeArqfsDriver();
    createArqfsSchemaLatest(driver, createArqfsSchemaV1);

    expect(checkArqfsIntegrity(driver).ok).toBe(true);
  });

  /**
   * A foreign-key violation must be reported even though the file's pages are
   * intact: `PRAGMA foreign_keys = ON` only constrains new writes, so a row that
   * was inserted while enforcement was off stays invisible without this check.
   */
  it('reports a dangling foreign-key row as not ok while quick-check still passes', () => {
    driver = createNodeArqfsDriver();
    createArqfsSchemaLatest(driver, createArqfsSchemaV1);

    driver.run('PRAGMA foreign_keys = OFF');
    driver.run(
      `INSERT INTO resource_reference (resource_sha256, owner_kind, owner_id, role)
       VALUES (?, 'model-element', 'wall-1', 'material')`,
      ['0'.repeat(64)],
    );

    const report = checkArqfsIntegrity(driver);
    expect(report.quickCheck).toEqual(['ok']);
    expect(report.foreignKeyViolations.length).toBeGreaterThan(0);
    expect(report.ok).toBe(false);
  });
});
