import type { ArqfsDriver } from './arqfs-driver';
import { createArqfsSchemaV1 } from './arqfs-schema';
import { createArqfsSchemaLatest } from './arqfs-schema-v2';
import { openArqfs } from './arqfs-open';
import { putArchiveEntries, getArchiveEntry, listArchiveEntryPaths } from './arqfs-archive-store';
import type { ArqfsWorkerRequest, ArqfsWorkerResponse } from './arqfs-worker-protocol';

export interface ArqfsWorkerContext {
  readonly driver: ArqfsDriver;
  /** Which VFS actually opened this driver ('opfs-sahpool', or an honest fallback description) - see workers/arqfs-worker. */
  readonly usedVfs: string;
}

/**
 * Pure request handling, deliberately factored out of workers/arqfs-worker's actual
 * `self.onmessage` wiring so it is unit-testable in Node against the same
 * `ArqfsDriver` interface (e.g. the better-sqlite3 driver already used by
 * arqfs-schema.test.ts) without needing a real browser Worker or sqlite-wasm at all.
 * Never throws - every branch is caught and reported as an `ok: false` response, so a
 * single bad request cannot crash the worker's message loop.
 */
export function handleArqfsWorkerRequest(
  context: ArqfsWorkerContext,
  request: ArqfsWorkerRequest,
): ArqfsWorkerResponse {
  try {
    switch (request.type) {
      case 'open': {
        // application_id reads as 0 only on a database SQLite itself has never
        // touched (its own default) - safe to initialize. Any other value, right or
        // wrong, is left to openArqfs to accept or reject; this must never overwrite
        // a real conflict. A brand-new file always starts at the latest schema
        // (FP-005) - there is no reason for a file created today to start on an
        // already-superseded schema version.
        if (context.driver.pragma('application_id') === 0) {
          createArqfsSchemaLatest(context.driver, createArqfsSchemaV1);
        }
        const result = openArqfs(context.driver);
        return {
          id: request.id,
          ok: true,
          payload: { kind: 'open', result, usedVfs: context.usedVfs },
        };
      }
      case 'putArchiveEntries': {
        putArchiveEntries(context.driver, new Map(request.entries));
        return { id: request.id, ok: true, payload: { kind: 'putArchiveEntries' } };
      }
      case 'getArchiveEntry': {
        const content = getArchiveEntry(context.driver, request.path);
        return { id: request.id, ok: true, payload: { kind: 'getArchiveEntry', content } };
      }
      case 'listArchiveEntryPaths': {
        const paths = listArchiveEntryPaths(context.driver);
        return { id: request.id, ok: true, payload: { kind: 'listArchiveEntryPaths', paths } };
      }
      case 'close': {
        context.driver.close();
        return { id: request.id, ok: true, payload: { kind: 'close' } };
      }
    }
  } catch (error) {
    return {
      id: request.id,
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
