import { describe, expect, it, afterEach, beforeEach } from 'vitest';
import { existsSync, mkdtempSync, readFileSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createNodeArqfsDriver } from './arqfs-node-driver';
import { createArqfsSchemaV1 } from './arqfs-schema';
import { initializeWorkingCopyState } from './arqfs-working-copy';
import { putArchiveEntry } from './arqfs-archive-store';
import {
  createArqfsWorkerSession,
  handleArqfsWorkerRequest,
  type ArqfsWorkerContext,
} from './arqfs-worker-handler';
import { ARQFS_SCHEMA_VERSION_V2 } from './arqfs-schema-v2';
import type { ArqfsDriver } from './arqfs-driver';

describe('handleArqfsWorkerRequest', () => {
  let driver: ArqfsDriver;
  let context: ArqfsWorkerContext;

  afterEach(() => {
    driver?.close();
  });

  function freshContext(): ArqfsWorkerContext {
    driver = createNodeArqfsDriver();
    context = { driver, usedVfs: 'test-node-driver', session: createArqfsWorkerSession() };
    return context;
  }

  it("initialises the latest schema (not v1) on 'open' for a brand new (application_id = 0) database", async () => {
    const ctx = freshContext();

    const response = await handleArqfsWorkerRequest(ctx, { id: 1, type: 'open' });

    expect(response.ok).toBe(true);
    if (response.ok && response.payload.kind === 'open') {
      expect(response.payload.result.status).toBe('opened');
      expect(response.payload.usedVfs).toBe('test-node-driver');
      if (response.payload.result.status === 'opened') {
        // FP-005: a real new file must never start on an already-superseded schema.
        expect(response.payload.result.header.schema).toBe(ARQFS_SCHEMA_VERSION_V2);
      }
    } else {
      throw new Error('expected an open payload');
    }
  });

  it("'open' is idempotent - opening an already-initialised database again does not fail or re-create the schema", async () => {
    const ctx = freshContext();
    await handleArqfsWorkerRequest(ctx, { id: 1, type: 'open' });

    const second = await handleArqfsWorkerRequest(ctx, { id: 2, type: 'open' });

    expect(second.ok).toBe(true);
    if (second.ok && second.payload.kind === 'open') {
      expect(second.payload.result.status).toBe('opened');
    }
  });

  it('round-trips archive entries through putArchiveEntries/getArchiveEntry/listArchiveEntryPaths', async () => {
    const ctx = freshContext();
    await handleArqfsWorkerRequest(ctx, { id: 1, type: 'open' });

    const content = new TextEncoder().encode('{"walls":[]}');
    const putResponse = await handleArqfsWorkerRequest(ctx, {
      id: 2,
      type: 'putArchiveEntries',
      entries: [['model.json', content]],
    });
    expect(putResponse.ok).toBe(true);

    const getResponse = await handleArqfsWorkerRequest(ctx, {
      id: 3,
      type: 'getArchiveEntry',
      path: 'model.json',
    });
    expect(getResponse.ok).toBe(true);
    if (getResponse.ok && getResponse.payload.kind === 'getArchiveEntry') {
      expect(getResponse.payload.content).toEqual(content);
    }

    const listResponse = await handleArqfsWorkerRequest(ctx, {
      id: 4,
      type: 'listArchiveEntryPaths',
    });
    expect(listResponse.ok).toBe(true);
    if (listResponse.ok && listResponse.payload.kind === 'listArchiveEntryPaths') {
      expect(listResponse.payload.paths).toEqual(['model.json']);
    }
  });

  it("'getArchiveEntry' for a missing path returns null, not an error", async () => {
    const ctx = freshContext();
    await handleArqfsWorkerRequest(ctx, { id: 1, type: 'open' });

    const response = await handleArqfsWorkerRequest(ctx, {
      id: 2,
      type: 'getArchiveEntry',
      path: 'missing.json',
    });
    expect(response.ok).toBe(true);
    if (response.ok && response.payload.kind === 'getArchiveEntry') {
      expect(response.payload.content).toBeNull();
    }
  });

  it("'close' closes the driver and reports ok", async () => {
    const ctx = freshContext();
    await handleArqfsWorkerRequest(ctx, { id: 1, type: 'open' });

    const response = await handleArqfsWorkerRequest(ctx, { id: 2, type: 'close' });
    expect(response).toEqual({ id: 2, ok: true, payload: { kind: 'close' } });
  });

  it('reports a failed request as ok: false rather than throwing past the handler', async () => {
    const ctx = freshContext();
    await handleArqfsWorkerRequest(ctx, { id: 1, type: 'open' });
    await handleArqfsWorkerRequest(ctx, { id: 2, type: 'close' });

    // Deliberately `open` and not an archive read. The driver is closed, so this
    // reaches the driver and throws, which is the try/catch this test is about.
    // An archive read would now be turned away by the read gate before touching
    // the driver at all - a true `ok: false`, but produced by a different
    // mechanism, leaving the crash-containment path unexercised.
    const response = await handleArqfsWorkerRequest(ctx, { id: 3, type: 'open' });
    expect(response.ok).toBe(false);
    if (!response.ok) {
      expect(response.code).toBe('ARQFS_WORKER_UNEXPECTED_ERROR');
      expect(response.error.length).toBeGreaterThan(0);
    }
  });
});

/**
 * The read side of the same gate the write side already had.
 *
 * `getArchiveEntry` and `listArchiveEntryPaths` consulted nothing before
 * answering: a worker holding an open driver would hand back project entries for
 * a file it had never opened, and for a file whose open it had explicitly
 * rejected - rejection leaves the driver connected and only records a verdict
 * these paths never read.
 */
describe('the read gate', () => {
  let driver: ArqfsDriver;

  afterEach(() => {
    driver?.close();
  });

  function context(): ArqfsWorkerContext {
    driver = createNodeArqfsDriver();
    return { driver, usedVfs: 'test-node-driver', session: createArqfsWorkerSession() };
  }

  const readRequests = [
    { type: 'getArchiveEntry', path: 'model.json' },
    { type: 'listArchiveEntryPaths' },
    { type: 'readAllArchiveEntries' },
  ] as const;

  it.each(readRequests)('refuses $type before any open', async (request) => {
    const ctx = context();

    const response = await handleArqfsWorkerRequest(ctx, { id: 1, ...request });

    expect(response.ok).toBe(false);
    if (!response.ok) {
      expect(response.code).toBe('ARQFS_WORKER_NOT_OPENED');
      expect(response.error).toContain('Nothing was read');
    }
  });

  it.each(readRequests)('refuses $type after an open this build rejected', async (request) => {
    const ctx = context();
    await handleArqfsWorkerRequest(ctx, { id: 1, type: 'open' });
    // Author a file openArqfs must reject outright, then re-open so the session
    // carries the rejection.
    ctx.driver.exec(`UPDATE arqfs_meta SET value = 'not-a-number' WHERE key = 'format_major'`);
    const reopened = await handleArqfsWorkerRequest(ctx, { id: 2, type: 'open' });
    expect(reopened.ok).toBe(true);
    if (reopened.ok && reopened.payload.kind === 'open') {
      expect(reopened.payload.result.status).toBe('rejected');
    }

    const response = await handleArqfsWorkerRequest(ctx, { id: 3, ...request });

    expect(response.ok).toBe(false);
    if (!response.ok) {
      expect(response.code).toBe('ARQFS_WORKER_OPEN_REJECTED');
      expect(response.error).toContain('Nothing was read');
    }
  });

  it.each(readRequests)(
    'refuses $type for a file that opened only in safe mode, whose semantics this build does not fully understand',
    async (request) => {
      const ctx = context();
      await handleArqfsWorkerRequest(ctx, { id: 1, type: 'open' });
      ctx.driver.exec(`UPDATE arqfs_meta SET value = '99' WHERE key = 'min_reader_major'`);
      const reopened = await handleArqfsWorkerRequest(ctx, { id: 2, type: 'open' });
      expect(reopened.ok).toBe(true);
      if (reopened.ok && reopened.payload.kind === 'open') {
        expect(reopened.payload.result.status).toBe('opened');
        if (reopened.payload.result.status === 'opened') {
          expect(reopened.payload.result.capabilities.canRead).toBe(false);
          expect(reopened.payload.result.capabilities.safeModeRequired).toBe(true);
        }
      }

      const response = await handleArqfsWorkerRequest(ctx, { id: 3, ...request });

      expect(response.ok).toBe(false);
      if (!response.ok) {
        expect(response.code).toBe('ARQFS_WORKER_OPEN_REJECTED');
      }
    },
  );

  it('allows reads once the file is genuinely open, and returns every entry in one call', async () => {
    const ctx = context();
    await handleArqfsWorkerRequest(ctx, { id: 1, type: 'open' });
    await handleArqfsWorkerRequest(ctx, {
      id: 2,
      type: 'putArchiveEntries',
      entries: [
        ['manifest.json', new TextEncoder().encode('{"projectId":"p"}')],
        ['model.json', new TextEncoder().encode('{"walls":[]}')],
      ],
    });

    const response = await handleArqfsWorkerRequest(ctx, { id: 3, type: 'readAllArchiveEntries' });

    expect(response.ok).toBe(true);
    if (response.ok && response.payload.kind === 'readAllArchiveEntries') {
      expect(response.payload.entries.map(([path]) => path)).toEqual([
        'manifest.json',
        'model.json',
      ]);
      const model = response.payload.entries.find(([path]) => path === 'model.json')?.[1];
      expect(new TextDecoder().decode(model)).toBe('{"walls":[]}');
    } else {
      throw new Error('expected a readAllArchiveEntries payload');
    }
  });

  it('closing forgets the open decision, so a later read is refused again', async () => {
    const ctx = context();
    await handleArqfsWorkerRequest(ctx, { id: 1, type: 'open' });
    await handleArqfsWorkerRequest(ctx, {
      id: 2,
      type: 'putArchiveEntries',
      entries: [['model.json', new TextEncoder().encode('{"walls":[]}')]],
    });
    await handleArqfsWorkerRequest(ctx, { id: 3, type: 'close' });

    const response = await handleArqfsWorkerRequest(ctx, { id: 4, type: 'listArchiveEntryPaths' });

    expect(response.ok).toBe(false);
    if (!response.ok) {
      expect(response.code).toBe('ARQFS_WORKER_NOT_OPENED');
    }
  });
});

describe('the write gate', () => {
  let driver: ArqfsDriver;

  afterEach(() => {
    driver?.close();
  });

  async function openedContext(): Promise<ArqfsWorkerContext> {
    driver = createNodeArqfsDriver();
    const context: ArqfsWorkerContext = {
      driver,
      usedVfs: 'test-node-driver',
      session: createArqfsWorkerSession(),
    };
    await handleArqfsWorkerRequest(context, { id: 1, type: 'open' });
    return context;
  }

  const entry: ReadonlyArray<readonly [string, Uint8Array]> = [
    ['model.json', new TextEncoder().encode('{"walls":[]}')],
  ];

  it('refuses a write that arrives before any open', async () => {
    driver = createNodeArqfsDriver();
    const context: ArqfsWorkerContext = {
      driver,
      usedVfs: 'test-node-driver',
      session: createArqfsWorkerSession(),
    };

    const response = await handleArqfsWorkerRequest(context, {
      id: 1,
      type: 'putArchiveEntries',
      entries: entry,
    });

    expect(response.ok).toBe(false);
    if (!response.ok) {
      expect(response.code).toBe('ARQFS_WORKER_NOT_OPENED');
    }
  });

  /**
   * The defect this gate exists for: `open` decided this build must not write
   * the file, and the very next message wrote it anyway.
   */
  it('refuses a write to a file that declares a newer writer, and leaves it unchanged', async () => {
    const context = await openedContext();
    // Author a file this build may read but must not write.
    context.driver.exec(`UPDATE arqfs_meta SET value = '99' WHERE key = 'min_writer_major'`);
    const reopened = await handleArqfsWorkerRequest(context, { id: 2, type: 'open' });
    expect(reopened.ok).toBe(true);
    if (reopened.ok && reopened.payload.kind === 'open') {
      expect(reopened.payload.result.status).toBe('opened');
      if (reopened.payload.result.status === 'opened') {
        expect(reopened.payload.result.capabilities.canRead).toBe(true);
        expect(reopened.payload.result.capabilities.canWrite).toBe(false);
      }
    }

    const before = await handleArqfsWorkerRequest(context, {
      id: 3,
      type: 'listArchiveEntryPaths',
    });
    const response = await handleArqfsWorkerRequest(context, {
      id: 4,
      type: 'putArchiveEntries',
      entries: entry,
    });
    const after = await handleArqfsWorkerRequest(context, { id: 5, type: 'listArchiveEntryPaths' });

    expect(response.ok).toBe(false);
    if (!response.ok) {
      expect(response.code).toBe('ARQFS_WORKER_FILE_NOT_WRITABLE');
      expect(response.error).toContain('Nothing was written');
    }
    // The refusal is real, not cosmetic: the file did not change.
    expect(after).toEqual({ ...before, id: 5 });
  });

  it('still allows a write to a file this build is qualified to write', async () => {
    const context = await openedContext();

    const response = await handleArqfsWorkerRequest(context, {
      id: 2,
      type: 'putArchiveEntries',
      entries: entry,
    });

    expect(response.ok).toBe(true);
    const listed = await handleArqfsWorkerRequest(context, {
      id: 3,
      type: 'listArchiveEntryPaths',
    });
    if (listed.ok && listed.payload.kind === 'listArchiveEntryPaths') {
      expect(listed.payload.paths).toContain('model.json');
    } else {
      throw new Error('expected a listArchiveEntryPaths payload');
    }
  });

  it('closing forgets the open decision, so a later write is refused again', async () => {
    const context = await openedContext();
    await handleArqfsWorkerRequest(context, { id: 2, type: 'close' });

    const response = await handleArqfsWorkerRequest(context, {
      id: 3,
      type: 'putArchiveEntries',
      entries: entry,
    });

    expect(response.ok).toBe(false);
    if (!response.ok) {
      expect(response.code).toBe('ARQFS_WORKER_NOT_OPENED');
    }
  });
});

describe('the defensive open policy', () => {
  let driver: ArqfsDriver;

  afterEach(() => {
    driver?.close();
  });

  /**
   * `applyDefensiveOpenPolicy` had no non-test caller, so in the real browser
   * runtime none of this was in force: foreign keys were off, which makes every
   * declared REFERENCES and ON DELETE CASCADE in schema v1 and v2 inert, and
   * trusted_schema was on for a file Arq did not write.
   */
  it('is in force after an open, not merely available', async () => {
    driver = createNodeArqfsDriver();
    const context: ArqfsWorkerContext = {
      driver,
      usedVfs: 'test-node-driver',
      session: createArqfsWorkerSession(),
    };
    await handleArqfsWorkerRequest(context, { id: 1, type: 'open' });

    // Set every pragma the policy owns to the wrong value first. Asserting a
    // "before" state instead would test the driver's defaults rather than the
    // policy: better-sqlite3 happens to default foreign_keys ON, and the
    // sqlite-wasm build the browser actually uses does not. That difference is
    // the whole reason the policy has to be applied explicitly.
    driver.exec('PRAGMA foreign_keys = OFF');
    // security-lint: allow - unsafe value set on purpose; asserted back off below.
    driver.exec('PRAGMA trusted_schema = ON');
    expect(driver.pragma('foreign_keys')).toBe(0);
    expect(driver.pragma('trusted_schema')).toBe(1);

    await handleArqfsWorkerRequest(context, { id: 2, type: 'open' });

    expect(driver.pragma('foreign_keys')).toBe(1);
    expect(driver.pragma('trusted_schema')).toBe(0);
    expect(driver.pragma('query_only')).toBe(0);
  });

  it('clears query-only again when a later open finds the file writable', async () => {
    driver = createNodeArqfsDriver();
    const context: ArqfsWorkerContext = {
      driver,
      usedVfs: 'test-node-driver',
      session: createArqfsWorkerSession(),
    };
    await handleArqfsWorkerRequest(context, { id: 1, type: 'open' });
    driver.exec('PRAGMA query_only = ON');

    await handleArqfsWorkerRequest(context, { id: 2, type: 'open' });

    // A pragma is connection state, not a one-way switch. Leaving it alone on
    // the writable path would strand a connection read-only for its lifetime.
    expect(driver.pragma('query_only')).toBe(0);
  });

  it('opens a file it must not write in query-only mode, so even a direct write fails', async () => {
    driver = createNodeArqfsDriver();
    const context: ArqfsWorkerContext = {
      driver,
      usedVfs: 'test-node-driver',
      session: createArqfsWorkerSession(),
    };
    await handleArqfsWorkerRequest(context, { id: 1, type: 'open' });
    context.driver.exec(`UPDATE arqfs_meta SET value = '99' WHERE key = 'min_writer_major'`);

    await handleArqfsWorkerRequest(context, { id: 2, type: 'open' });

    expect(driver.pragma('query_only')).toBe(1);
    // Belt and braces: the gate refuses the request, and SQLite itself would
    // refuse the statement even if something reached past the gate.
    expect(() => driver.exec("INSERT INTO arqfs_meta (key, value) VALUES ('x', 'y')")).toThrow();
  });
});

/**
 * Seeding the working copy from selected bytes - the command that makes native
 * project opening reachable at all. `opfs-sahpool` keeps databases inside a pool
 * of opaque files rather than at the filename it was given, so the main thread
 * cannot write a selected `.arq` somewhere SQLite will find it. Only the Worker's
 * pool utility can import, which is why this crosses the protocol.
 */
describe('importing a database into the working copy', () => {
  let driver: ArqfsDriver;

  afterEach(() => {
    driver?.close();
  });

  function contextWithImporter(): {
    readonly context: ArqfsWorkerContext;
    readonly imported: Uint8Array[];
  } {
    driver = createNodeArqfsDriver();
    const imported: Uint8Array[] = [];
    return {
      context: {
        driver,
        usedVfs: 'test-node-driver',
        session: createArqfsWorkerSession(),
        importDatabase: (bytes) => {
          imported.push(bytes);
        },
      },
      imported,
    };
  }

  it('hands the selected bytes to the Worker that owns the pool', async () => {
    const { context, imported } = contextWithImporter();
    const bytes = new Uint8Array([1, 2, 3, 4]);

    const response = await handleArqfsWorkerRequest(context, {
      id: 1,
      type: 'importDatabase',
      bytes,
    });

    expect(response.ok).toBe(true);
    if (response.ok && response.payload.kind === 'importDatabase') {
      expect(response.payload.byteLength).toBe(4);
    }
    expect(imported).toEqual([bytes]);
  });

  /**
   * An import replaces every byte of the working copy, so a verdict reached
   * about the outgoing database describes a file that no longer exists.
   * Carrying it forward would measure the imported project's gates against the
   * wrong file - and, in the worst case, let a rejected file's replacement be
   * read without ever being opened.
   */
  it('forgets what the previous open decided, forcing a fresh open', async () => {
    const { context } = contextWithImporter();
    await handleArqfsWorkerRequest(context, { id: 1, type: 'open' });
    expect(context.session.openResult).not.toBeNull();

    await handleArqfsWorkerRequest(context, {
      id: 2,
      type: 'importDatabase',
      bytes: new Uint8Array([1]),
    });

    expect(context.session.openResult).toBeNull();
    const read = await handleArqfsWorkerRequest(context, { id: 3, type: 'listArchiveEntryPaths' });
    expect(read.ok).toBe(false);
    if (!read.ok) {
      expect(read.code).toBe('ARQFS_WORKER_NOT_OPENED');
    }
  });

  it('refuses rather than silently ignoring an import it cannot perform', async () => {
    driver = createNodeArqfsDriver();
    const context: ArqfsWorkerContext = {
      driver,
      usedVfs: 'test-node-driver',
      session: createArqfsWorkerSession(),
    };

    const response = await handleArqfsWorkerRequest(context, {
      id: 1,
      type: 'importDatabase',
      bytes: new Uint8Array([1]),
    });

    expect(response.ok).toBe(false);
    if (!response.ok) {
      expect(response.error).toContain('cannot import');
    }
  });
  it('refuses an unrecognised request type instead of returning nothing at all', async () => {
    driver = createNodeArqfsDriver();
    const context: ArqfsWorkerContext = {
      driver,
      usedVfs: 'test-node-driver',
      session: createArqfsWorkerSession(),
    };

    // V3-021. The switch covers every union member, so TypeScript reads it as
    // exhaustive - but `request` crosses a Worker boundary, where the union is a
    // claim about the caller rather than a fact about the value. Without the
    // `default` this returned `undefined`, the Worker posted that, and the caller
    // waited out its whole timeout for a request refused the moment it arrived.
    const response = await handleArqfsWorkerRequest(context, {
      id: 11,
      type: 'exec',
      sql: 'DROP TABLE archive_entries',
    } as never);

    expect(response).toBeDefined();
    expect(response.ok).toBe(false);
    if (!response.ok) {
      expect(response.id).toBe(11);
      expect(response.code).toBe('ARQFS_WORKER_MALFORMED_REQUEST');
      expect(response.error).toContain('Nothing was attempted');
    }
  });
});

/**
 * The Worker publish command. Publication only means anything if the reader
 * shares nothing with the writer, and only the Worker's VFS can produce such a
 * reader - which is why this command exists rather than the main thread asking
 * for bytes and checking them itself.
 */
describe('publish', () => {
  let driver: ArqfsDriver;
  let workDir: string;

  beforeEach(() => {
    workDir = mkdtempSync(join(tmpdir(), 'arqfs-worker-publish-'));
  });

  afterEach(() => {
    driver?.close();
    rmSync(workDir, { recursive: true, force: true });
  });

  function publishingContext(): { context: ArqfsWorkerContext; removed: string[] } {
    driver = createNodeArqfsDriver(join(workDir, 'working.arq'));
    createArqfsSchemaV1(driver);
    initializeWorkingCopyState(driver, 'project-alpha');
    putArchiveEntry(driver, 'model.json', new TextEncoder().encode('{"walls":[{"id":"w1"}]}'));
    const removed: string[] = [];
    return {
      removed,
      context: {
        driver,
        usedVfs: 'test-node-driver',
        session: createArqfsWorkerSession(),
        publication: {
          environment: {
            openFreshReader: (target) => createNodeArqfsDriver(target),
            listSidecars: (target) =>
              [`${target}-wal`, `${target}-shm`].filter((sidecar) => existsSync(sidecar)),
            byteLength: (target) => statSync(target).size,
          },
          readTarget: (target) => new Uint8Array(readFileSync(target)),
          removeTarget: (target) => {
            removed.push(target);
            rmSync(target, { force: true });
          },
        },
      },
    };
  }

  function target(name = 'published.arq'): string {
    return join(workDir, name);
  }

  it('publishes, verifies and returns the bytes together with the receipt', async () => {
    const { context } = publishingContext();
    await handleArqfsWorkerRequest(context, { id: 1, type: 'open' });

    const response = await handleArqfsWorkerRequest(context, {
      id: 2,
      type: 'publish',
      targetName: target(),
    });

    expect(response.ok).toBe(true);
    if (response.ok && response.payload.kind === 'publish') {
      expect(response.payload.result.status).toBe('published');
      // The bytes and the verdict arrive together, so no caller can hand over a
      // file without the receipt saying it was checked.
      expect(response.payload.bytes).toBeInstanceOf(Uint8Array);
      expect((response.payload.bytes?.byteLength ?? 0) > 0).toBe(true);
      if (response.payload.result.status === 'published') {
        expect(response.payload.result.receipt.verifiedBy).toBe('fresh-reader');
        expect(response.payload.result.receipt.projectId).toBe('project-alpha');
      }
    }
  });

  it('records the outcome on the working project', async () => {
    const { context } = publishingContext();
    await handleArqfsWorkerRequest(context, { id: 1, type: 'open' });

    await handleArqfsWorkerRequest(context, { id: 2, type: 'publish', targetName: target() });

    const [row] = context.driver.query<{ publication_state: string }>(
      'SELECT publication_state FROM working_copy_state WHERE id = 1',
    );
    expect(row?.publication_state).toBe('current');
  });

  it('refuses a revision the working project is not on, and writes nothing', async () => {
    const { context } = publishingContext();
    await handleArqfsWorkerRequest(context, { id: 1, type: 'open' });

    const response = await handleArqfsWorkerRequest(context, {
      id: 2,
      type: 'publish',
      targetName: target(),
      expectedRevision: 99,
    });

    expect(response.ok).toBe(true);
    if (response.ok && response.payload.kind === 'publish') {
      expect(response.payload.result.status).toBe('refused');
      expect(response.payload.bytes).toBeNull();
    }
    expect(existsSync(target())).toBe(false);
  });

  it('removes a target it wrote but could not verify, so the next attempt is not refused for target-exists', async () => {
    const { context, removed } = publishingContext();
    await handleArqfsWorkerRequest(context, { id: 1, type: 'open' });
    // A reader that rejects everything: the bytes are written by VACUUM INTO and
    // then fail verification, which is exactly the case that leaves a file behind.
    const failing: ArqfsWorkerContext = {
      ...context,
      publication: {
        ...context.publication!,
        environment: {
          ...context.publication!.environment,
          openFreshReader: () => {
            throw new Error('reader unavailable');
          },
        },
      },
    };

    const response = await handleArqfsWorkerRequest(failing, {
      id: 2,
      type: 'publish',
      targetName: target(),
    });

    expect(response.ok).toBe(true);
    if (response.ok && response.payload.kind === 'publish') {
      expect(response.payload.result.status).toBe('refused');
    }
    expect(removed).toEqual([target()]);
    expect(existsSync(target())).toBe(false);
  });

  it('records a failure on the working project when publication is refused', async () => {
    const { context } = publishingContext();
    await handleArqfsWorkerRequest(context, { id: 1, type: 'open' });

    await handleArqfsWorkerRequest(context, {
      id: 2,
      type: 'publish',
      targetName: target(),
      expectedRevision: 99,
    });

    const [row] = context.driver.query<{ publication_state: string }>(
      'SELECT publication_state FROM working_copy_state WHERE id = 1',
    );
    expect(row?.publication_state).toBe('failed');
  });

  it('refuses to publish before any open', async () => {
    const { context } = publishingContext();

    const response = await handleArqfsWorkerRequest(context, {
      id: 1,
      type: 'publish',
      targetName: target(),
    });

    expect(response.ok).toBe(false);
    if (!response.ok) {
      expect(response.code).toBe('ARQFS_WORKER_NOT_OPENED');
    }
    expect(existsSync(target())).toBe(false);
  });

  it('refuses rather than silently skipping publication it cannot perform', async () => {
    const { context } = publishingContext();
    const { publication: _publication, ...withoutPublication } = context;
    await handleArqfsWorkerRequest(withoutPublication, { id: 1, type: 'open' });

    const response = await handleArqfsWorkerRequest(withoutPublication, {
      id: 2,
      type: 'publish',
      targetName: target(),
    });

    expect(response.ok).toBe(false);
    if (!response.ok) {
      expect(response.code).toBe('ARQFS_WORKER_PUBLISH_UNAVAILABLE');
    }
  });
});
