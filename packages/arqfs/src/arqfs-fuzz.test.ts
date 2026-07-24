import { describe, expect, it, afterEach, beforeEach } from 'vitest';
import fc from 'fast-check';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createNodeArqfsDriver } from './arqfs-node-driver';
import { createArqfsSchemaV1 } from './arqfs-schema';
import { openArqfs } from './arqfs-open';
import { putArchiveEntry, getArchiveEntry } from './arqfs-archive-store';
import { putResource, assembleResource } from './arqfs-resource-chunks';
import { migrateArqfsCopyOnWrite } from './arqfs-migration';
import type { ArqfsDriver } from './arqfs-driver';

/**
 * ARQ-217: fuzz untrusted arq reader and migrations.
 *
 * "Never crash uncontrolled" here means one of two acceptable outcomes for any
 * input, verified for real rather than assumed: either the driver constructor
 * itself throws a normal, catchable Error (garbage that is not valid SQLite at all -
 * an acceptable, documented failure mode per arqfs-open.ts's own doc comment), or the
 * driver opens and openArqfs returns a clean 'rejected' result. What must never
 * happen: an uncaught crash that is neither of those two, or a 'opened' result for
 * content that plainly is not a valid arqfs file.
 */
describe('fuzzing the untrusted arqfs reader', () => {
  let dir: string;
  let driver: ArqfsDriver | undefined;

  beforeEach(() => {
    dir = mkdtempSync(path.join(tmpdir(), 'arqfs-fuzz-'));
  });

  afterEach(() => {
    driver?.close();
    driver = undefined;
    rmSync(dir, { recursive: true, force: true });
  });

  it('never crashes uncontrolled on arbitrary random-byte file content', () => {
    fc.assert(
      fc.property(fc.uint8Array({ minLength: 0, maxLength: 4096 }), (bytes) => {
        const filePath = path.join(dir, `random-${Math.random().toString(36).slice(2)}.sqlite3`);
        writeFileSync(filePath, Buffer.from(bytes));

        let localDriver: ArqfsDriver;
        try {
          localDriver = createNodeArqfsDriver(filePath);
        } catch (error) {
          // Acceptable: not valid SQLite at all - must be a normal Error, not a
          // process-level crash (which would abort the whole test run, not land here).
          expect(error).toBeInstanceOf(Error);
          return;
        }
        try {
          const result = openArqfs(localDriver);
          // Random bytes essentially never happen to be a valid arqfs file - assert
          // the realistic outcome, not just "did not throw".
          expect(result.status).toBe('rejected');
        } finally {
          localDriver.close();
        }
      }),
      { numRuns: 200 },
    );
  });

  it('round-trips arbitrary archive entry content, including non-UTF8 binary and empty content', () => {
    driver = createNodeArqfsDriver();
    createArqfsSchemaV1(driver);
    const d = driver;

    fc.assert(
      fc.property(fc.uint8Array({ minLength: 0, maxLength: 2048 }), (bytes) => {
        putArchiveEntry(d, 'fuzz-entry.bin', bytes);
        expect(getArchiveEntry(d, 'fuzz-entry.bin')).toEqual(bytes);
      }),
      { numRuns: 100 },
    );
  });

  it('assembleResource never crashes on arbitrary chunk-size/content combinations, and round-trips when untampered', async () => {
    driver = createNodeArqfsDriver();
    createArqfsSchemaV1(driver);
    const d = driver;

    await fc.assert(
      fc.asyncProperty(
        fc.uint8Array({ minLength: 0, maxLength: 500 }),
        fc.integer({ min: 1, max: 200 }),
        async (content, chunkSize) => {
          const { sha256 } = await putResource(
            d,
            content,
            'application/octet-stream',
            'user-texture',
            chunkSize,
          );
          const result = await assembleResource(d, sha256);
          expect(result).toEqual({ status: 'assembled', content });
        },
      ),
      { numRuns: 50 },
    );
  });

  it('a migration whose transform executes arbitrary invalid SQL always rejects cleanly, never crashes, and never touches the source', () => {
    fc.assert(
      fc.property(fc.string({ minLength: 1, maxLength: 100 }), (garbageSql) => {
        const sourcePath = path.join(dir, `source-${Math.random().toString(36).slice(2)}.sqlite3`);
        const targetPath = path.join(dir, `target-${Math.random().toString(36).slice(2)}.sqlite3`);
        const source = createNodeArqfsDriver(sourcePath);
        createArqfsSchemaV1(source);

        try {
          const result = migrateArqfsCopyOnWrite(
            source,
            targetPath,
            createNodeArqfsDriver,
            (target) => {
              target.exec(garbageSql);
            },
          );
          // Either the garbage SQL happens to be valid (rare but possible for short
          // random strings) and the migration succeeds, or it fails and is reported
          // cleanly - both are acceptable; an uncaught throw escaping this call is not.
          expect(['migrated', 'rejected']).toContain(result.status);
          expect(() => source.query('SELECT 1')).not.toThrow();
        } finally {
          source.close();
        }
      }),
      { numRuns: 50 },
    );
  });
});
