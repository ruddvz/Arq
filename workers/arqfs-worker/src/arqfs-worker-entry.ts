/**
 * The Arq-owned dedicated Worker that actually runs SQLite (ADR-0024, ARQ-196) -
 * nothing here runs on the UI thread. Loads the official sqlite-wasm build directly
 * (not the deprecated Worker1/Promiser convenience APIs, per ADR-0024), tries
 * `opfs-sahpool` as the primary VFS, and falls back to an in-memory database if OPFS
 * genuinely is not available in this context - reported honestly via `usedVfs`, never
 * silently treated as persisted.
 *
 * One dedicated Worker per project (ADR-0024's own framing) only actually isolates
 * projects if each Worker also opens a project-scoped OPFS filename: OPFS storage is
 * shared at the origin, not per-Worker, so two projects opened through a shared fixed
 * filename would silently read and write the same underlying file. The project id is
 * read from this Worker's own URL (`?project=<id>`, set by whoever constructs the
 * Worker - see `arqfs-worker-client.ts`) rather than a first postMessage, so the
 * correct file is already selected before the first request can race it.
 *
 * This file itself only wires postMessage to handleArqfsWorkerRequest
 * (@arq/arqfs, driver-agnostic, already unit-tested against the native Node driver)
 * plus the sqlite-wasm-specific driver construction below - it has no logic of its
 * own worth unit-testing beyond what a real headless-Chromium run
 * (scripts/run-arqfs-opfs-capability-check.mjs) can actually verify.
 */
import sqlite3InitModule from '@sqlite.org/sqlite-wasm';
// Deep imports, not the `@arq/arqfs` barrel: the barrel re-exports
// `arqfs-node-driver`, which pulls in `better-sqlite3`, a Node native addon that
// cannot be bundled for a browser. Importing the barrel here made this Worker
// unbundleable - the failure only appears when something actually tries to build
// it for the browser, which nothing did until
// scripts/run-e2e-arq-open-capability-check.mjs. `apps/web` already deep-imports
// `@arq/arqfs/src/arqfs-preflight` for the same reason.
import {
  ARQFS_WORKER_ERROR_CODES,
  type ArqfsWorkerRequest,
} from '@arq/arqfs/src/arqfs-worker-protocol';
import {
  createArqfsWorkerSession,
  handleArqfsWorkerRequest,
  type ArqfsWorkerContext,
} from '@arq/arqfs/src/arqfs-worker-handler';
import { createSqliteWasmArqfsDriver, type Sqlite3Oo1DatabaseLike } from './arqfs-opfs-driver';
import { opfsFilenameForProject, readProjectIdFromWorkerSearch } from './arqfs-project-filename';

const OPFS_SAHPOOL_VFS_NAME = 'arqfs-opfs-sahpool';

async function openContext(): Promise<ArqfsWorkerContext> {
  const projectId = readProjectIdFromWorkerSearch(self.location.search);
  const databaseFilename = opfsFilenameForProject(projectId);
  const sqlite3 = await sqlite3InitModule();
  // One session per Worker, and one Worker per project: what `open` decides
  // about this file is what every later write in this Worker is measured
  // against.
  const session = createArqfsWorkerSession();

  try {
    const poolUtil = await sqlite3.installOpfsSAHPoolVfs({ name: OPFS_SAHPOOL_VFS_NAME });
    const db = new poolUtil.OpfsSAHPoolDb(databaseFilename) as unknown as Sqlite3Oo1DatabaseLike;
    return { driver: createSqliteWasmArqfsDriver(db), usedVfs: 'opfs-sahpool', session };
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    const db = new sqlite3.oo1.DB(':memory:', 'ct') as unknown as Sqlite3Oo1DatabaseLike;
    return {
      driver: createSqliteWasmArqfsDriver(db),
      usedVfs: `memory-fallback (opfs-sahpool unavailable: ${reason})`,
      session,
    };
  }
}

const contextPromise = openContext();

self.onmessage = async (event: MessageEvent<ArqfsWorkerRequest>) => {
  try {
    const context = await contextPromise;
    self.postMessage(handleArqfsWorkerRequest(context, event.data));
  } catch (error) {
    // contextPromise rejects only for a Worker-construction mistake (missing/invalid
    // project id) that will never resolve on retry - every request gets a clear,
    // immediate error instead of silently hanging until the client's own timeout.
    self.postMessage({
      id: event.data.id,
      ok: false,
      code: ARQFS_WORKER_ERROR_CODES.unexpected,
      error: error instanceof Error ? error.message : String(error),
    });
  }
};
