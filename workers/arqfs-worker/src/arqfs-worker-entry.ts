/**
 * The Arq-owned dedicated Worker that actually runs SQLite (ADR-0024, ARQ-196) -
 * nothing here runs on the UI thread. Loads the official sqlite-wasm build directly
 * (not the deprecated Worker1/Promiser convenience APIs, per ADR-0024), tries
 * `opfs-sahpool` as the primary VFS, and falls back to an in-memory database if OPFS
 * genuinely is not available in this context - reported honestly via `usedVfs`, never
 * silently treated as persisted.
 *
 * This file itself only wires postMessage to handleArqfsWorkerRequest
 * (@arq/arqfs, driver-agnostic, already unit-tested against the native Node driver)
 * plus the sqlite-wasm-specific driver construction below - it has no logic of its
 * own worth unit-testing beyond what a real headless-Chromium run
 * (scripts/run-arqfs-opfs-capability-check.mjs) can actually verify.
 */
import sqlite3InitModule from '@sqlite.org/sqlite-wasm';
import {
  handleArqfsWorkerRequest,
  type ArqfsWorkerContext,
  type ArqfsWorkerRequest,
} from '@arq/arqfs';
import { createSqliteWasmArqfsDriver, type Sqlite3Oo1DatabaseLike } from './arqfs-opfs-driver';

const OPFS_DATABASE_FILENAME = '/arqfs-prototype.sqlite3';
const OPFS_SAHPOOL_VFS_NAME = 'arqfs-opfs-sahpool';

async function openContext(): Promise<ArqfsWorkerContext> {
  const sqlite3 = await sqlite3InitModule();

  try {
    const poolUtil = await sqlite3.installOpfsSAHPoolVfs({ name: OPFS_SAHPOOL_VFS_NAME });
    const db = new poolUtil.OpfsSAHPoolDb(
      OPFS_DATABASE_FILENAME,
    ) as unknown as Sqlite3Oo1DatabaseLike;
    return { driver: createSqliteWasmArqfsDriver(db), usedVfs: 'opfs-sahpool' };
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    const db = new sqlite3.oo1.DB(':memory:', 'ct') as unknown as Sqlite3Oo1DatabaseLike;
    return {
      driver: createSqliteWasmArqfsDriver(db),
      usedVfs: `memory-fallback (opfs-sahpool unavailable: ${reason})`,
    };
  }
}

const contextPromise = openContext();

self.onmessage = async (event: MessageEvent<ArqfsWorkerRequest>) => {
  const context = await contextPromise;
  const response = handleArqfsWorkerRequest(context, event.data);
  self.postMessage(response);
};
