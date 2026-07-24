import { describe, expect, it, afterEach } from 'vitest';
import { createNodeArqfsDriver } from './arqfs-node-driver';
import { handleArqfsWorkerRequest, type ArqfsWorkerContext } from './arqfs-worker-handler';
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
    context = { driver, usedVfs: 'test-node-driver' };
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
