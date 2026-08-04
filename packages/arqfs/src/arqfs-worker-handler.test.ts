import { describe, expect, it, afterEach } from 'vitest';
import { createNodeArqfsDriver } from './arqfs-node-driver';
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

  it("initialises the latest schema (not v1) on 'open' for a brand new (application_id = 0) database", () => {
    const ctx = freshContext();

    const response = handleArqfsWorkerRequest(ctx, { id: 1, type: 'open' });

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

  it("'open' is idempotent - opening an already-initialised database again does not fail or re-create the schema", () => {
    const ctx = freshContext();
    handleArqfsWorkerRequest(ctx, { id: 1, type: 'open' });

    const second = handleArqfsWorkerRequest(ctx, { id: 2, type: 'open' });

    expect(second.ok).toBe(true);
    if (second.ok && second.payload.kind === 'open') {
      expect(second.payload.result.status).toBe('opened');
    }
  });

  it('round-trips archive entries through putArchiveEntries/getArchiveEntry/listArchiveEntryPaths', () => {
    const ctx = freshContext();
    handleArqfsWorkerRequest(ctx, { id: 1, type: 'open' });

    const content = new TextEncoder().encode('{"walls":[]}');
    const putResponse = handleArqfsWorkerRequest(ctx, {
      id: 2,
      type: 'putArchiveEntries',
      entries: [['model.json', content]],
    });
    expect(putResponse.ok).toBe(true);

    const getResponse = handleArqfsWorkerRequest(ctx, {
      id: 3,
      type: 'getArchiveEntry',
      path: 'model.json',
    });
    expect(getResponse.ok).toBe(true);
    if (getResponse.ok && getResponse.payload.kind === 'getArchiveEntry') {
      expect(getResponse.payload.content).toEqual(content);
    }

    const listResponse = handleArqfsWorkerRequest(ctx, { id: 4, type: 'listArchiveEntryPaths' });
    expect(listResponse.ok).toBe(true);
    if (listResponse.ok && listResponse.payload.kind === 'listArchiveEntryPaths') {
      expect(listResponse.payload.paths).toEqual(['model.json']);
    }
  });

  it("'getArchiveEntry' for a missing path returns null, not an error", () => {
    const ctx = freshContext();
    handleArqfsWorkerRequest(ctx, { id: 1, type: 'open' });

    const response = handleArqfsWorkerRequest(ctx, {
      id: 2,
      type: 'getArchiveEntry',
      path: 'missing.json',
    });
    expect(response.ok).toBe(true);
    if (response.ok && response.payload.kind === 'getArchiveEntry') {
      expect(response.payload.content).toBeNull();
    }
  });

  it("'close' closes the driver and reports ok", () => {
    const ctx = freshContext();
    handleArqfsWorkerRequest(ctx, { id: 1, type: 'open' });

    const response = handleArqfsWorkerRequest(ctx, { id: 2, type: 'close' });
    expect(response).toEqual({ id: 2, ok: true, payload: { kind: 'close' } });
  });

  it('reports a failed request as ok: false rather than throwing past the handler', () => {
    const ctx = freshContext();
    handleArqfsWorkerRequest(ctx, { id: 1, type: 'open' });
    handleArqfsWorkerRequest(ctx, { id: 2, type: 'close' });

    // The driver is now closed - any further operation against it should fail
    // cleanly through the handler's own try/catch, not crash the test.
    const response = handleArqfsWorkerRequest(ctx, { id: 3, type: 'listArchiveEntryPaths' });
    expect(response.ok).toBe(false);
    if (!response.ok) {
      expect(response.error.length).toBeGreaterThan(0);
    }
  });
});

describe('the write gate', () => {
  let driver: ArqfsDriver;

  afterEach(() => {
    driver?.close();
  });

  function openedContext(): ArqfsWorkerContext {
    driver = createNodeArqfsDriver();
    const context: ArqfsWorkerContext = {
      driver,
      usedVfs: 'test-node-driver',
      session: createArqfsWorkerSession(),
    };
    handleArqfsWorkerRequest(context, { id: 1, type: 'open' });
    return context;
  }

  const entry: ReadonlyArray<readonly [string, Uint8Array]> = [
    ['model.json', new TextEncoder().encode('{"walls":[]}')],
  ];

  it('refuses a write that arrives before any open', () => {
    driver = createNodeArqfsDriver();
    const context: ArqfsWorkerContext = {
      driver,
      usedVfs: 'test-node-driver',
      session: createArqfsWorkerSession(),
    };

    const response = handleArqfsWorkerRequest(context, {
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
  it('refuses a write to a file that declares a newer writer, and leaves it unchanged', () => {
    const context = openedContext();
    // Author a file this build may read but must not write.
    context.driver.exec(`UPDATE arqfs_meta SET value = '99' WHERE key = 'min_writer_major'`);
    const reopened = handleArqfsWorkerRequest(context, { id: 2, type: 'open' });
    expect(reopened.ok).toBe(true);
    if (reopened.ok && reopened.payload.kind === 'open') {
      expect(reopened.payload.result.status).toBe('opened');
      if (reopened.payload.result.status === 'opened') {
        expect(reopened.payload.result.capabilities.canRead).toBe(true);
        expect(reopened.payload.result.capabilities.canWrite).toBe(false);
      }
    }

    const before = handleArqfsWorkerRequest(context, { id: 3, type: 'listArchiveEntryPaths' });
    const response = handleArqfsWorkerRequest(context, {
      id: 4,
      type: 'putArchiveEntries',
      entries: entry,
    });
    const after = handleArqfsWorkerRequest(context, { id: 5, type: 'listArchiveEntryPaths' });

    expect(response.ok).toBe(false);
    if (!response.ok) {
      expect(response.code).toBe('ARQFS_WORKER_FILE_NOT_WRITABLE');
      expect(response.error).toContain('Nothing was written');
    }
    // The refusal is real, not cosmetic: the file did not change.
    expect(after).toEqual({ ...before, id: 5 });
  });

  it('still allows a write to a file this build is qualified to write', () => {
    const context = openedContext();

    const response = handleArqfsWorkerRequest(context, {
      id: 2,
      type: 'putArchiveEntries',
      entries: entry,
    });

    expect(response.ok).toBe(true);
    const listed = handleArqfsWorkerRequest(context, { id: 3, type: 'listArchiveEntryPaths' });
    if (listed.ok && listed.payload.kind === 'listArchiveEntryPaths') {
      expect(listed.payload.paths).toContain('model.json');
    } else {
      throw new Error('expected a listArchiveEntryPaths payload');
    }
  });

  it('closing forgets the open decision, so a later write is refused again', () => {
    const context = openedContext();
    handleArqfsWorkerRequest(context, { id: 2, type: 'close' });

    const response = handleArqfsWorkerRequest(context, {
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
  it('is in force after an open, not merely available', () => {
    driver = createNodeArqfsDriver();
    const context: ArqfsWorkerContext = {
      driver,
      usedVfs: 'test-node-driver',
      session: createArqfsWorkerSession(),
    };
    handleArqfsWorkerRequest(context, { id: 1, type: 'open' });

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

    handleArqfsWorkerRequest(context, { id: 2, type: 'open' });

    expect(driver.pragma('foreign_keys')).toBe(1);
    expect(driver.pragma('trusted_schema')).toBe(0);
    expect(driver.pragma('query_only')).toBe(0);
  });

  it('clears query-only again when a later open finds the file writable', () => {
    driver = createNodeArqfsDriver();
    const context: ArqfsWorkerContext = {
      driver,
      usedVfs: 'test-node-driver',
      session: createArqfsWorkerSession(),
    };
    handleArqfsWorkerRequest(context, { id: 1, type: 'open' });
    driver.exec('PRAGMA query_only = ON');

    handleArqfsWorkerRequest(context, { id: 2, type: 'open' });

    // A pragma is connection state, not a one-way switch. Leaving it alone on
    // the writable path would strand a connection read-only for its lifetime.
    expect(driver.pragma('query_only')).toBe(0);
  });

  it('opens a file it must not write in query-only mode, so even a direct write fails', () => {
    driver = createNodeArqfsDriver();
    const context: ArqfsWorkerContext = {
      driver,
      usedVfs: 'test-node-driver',
      session: createArqfsWorkerSession(),
    };
    handleArqfsWorkerRequest(context, { id: 1, type: 'open' });
    context.driver.exec(`UPDATE arqfs_meta SET value = '99' WHERE key = 'min_writer_major'`);

    handleArqfsWorkerRequest(context, { id: 2, type: 'open' });

    expect(driver.pragma('query_only')).toBe(1);
    // Belt and braces: the gate refuses the request, and SQLite itself would
    // refuse the statement even if something reached past the gate.
    expect(() => driver.exec("INSERT INTO arqfs_meta (key, value) VALUES ('x', 'y')")).toThrow();
  });
});
