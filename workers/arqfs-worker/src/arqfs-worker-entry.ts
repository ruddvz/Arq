/**
 * The Arq-owned dedicated Worker that actually runs SQLite (ADR-0024, ARQ-196) -
 * nothing here runs on the UI thread. Loads the official sqlite-wasm build directly
 * (not the deprecated Worker1/Promiser convenience APIs, per ADR-0024).
 *
 * Two modes, chosen by this Worker's own URL before its first request can arrive:
 *
 * `?project=<id>` - the owned-project mode. Opens this origin's OPFS file for that
 * project, trying `opfs-sahpool` as the primary VFS and falling back to an in-memory
 * database if OPFS genuinely is not available - reported honestly via `usedVfs`,
 * never silently treated as persisted. One dedicated Worker per project only
 * actually isolates projects if each Worker also opens a project-scoped OPFS
 * filename: OPFS storage is shared at the origin, not per-Worker, so two projects
 * opened through a shared fixed filename would silently read and write the same
 * underlying file.
 *
 * `?source=selected-bytes` - the read-only mode for a file the user handed to the
 * product. It never installs a VFS, never opens an OPFS file and never writes
 * anything anywhere: the bytes are deserialized read-only into this Worker's own
 * heap (see arqfs-selected-bytes-db.ts) and freed when the connection closes. That
 * is what lets a user open and inspect a project while ADR-0028's persistence
 * responsibility split is still Proposed - opening a file decides nothing about who
 * owns durable local state, because nothing durable is created.
 *
 * This file itself only wires postMessage to handleArqfsWorkerRequest
 * (@arq/arqfs, driver-agnostic, already unit-tested against the native Node driver)
 * plus the sqlite-wasm-specific driver construction below - it has no logic of its
 * own worth unit-testing beyond what a real headless-Chromium run
 * (scripts/run-arqfs-opfs-capability-check.mjs,
 * scripts/run-e2e-arq-open-capability-check.mjs and
 * scripts/run-native-open-capability-check.mjs) can actually verify.
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
  type ArqfsWorkerResponse,
} from '@arq/arqfs/src/arqfs-worker-protocol';
import {
  createArqfsWorkerSession,
  handleArqfsWorkerRequest,
  type ArqfsWorkerContext,
} from '@arq/arqfs/src/arqfs-worker-handler';
import { createSqliteWasmArqfsDriver, type Sqlite3Oo1DatabaseLike } from './arqfs-opfs-driver';
import {
  openSelectedBytesReadOnly,
  type Sqlite3DeserializeModule,
} from './arqfs-selected-bytes-db';
import {
  opfsFilenameForProject,
  readProjectIdFromWorkerSearch,
  readWorkerSourceFromSearch,
} from './arqfs-project-filename';

const OPFS_SAHPOOL_VFS_NAME = 'arqfs-opfs-sahpool';

const source = readWorkerSourceFromSearch(self.location.search);

let sqlite3ModulePromise: Promise<Awaited<ReturnType<typeof sqlite3InitModule>>> | null = null;
function sqlite3Module(): Promise<Awaited<ReturnType<typeof sqlite3InitModule>>> {
  sqlite3ModulePromise ??= sqlite3InitModule();
  return sqlite3ModulePromise;
}

async function openOwnedProjectContext(): Promise<ArqfsWorkerContext> {
  const projectId = readProjectIdFromWorkerSearch(self.location.search);
  const databaseFilename = opfsFilenameForProject(projectId);
  const sqlite3 = await sqlite3Module();
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

/** Built on the owned-project path only, where the file to open is known up front. */
const ownedProjectContext = source === 'owned-project' ? openOwnedProjectContext() : null;

/**
 * On the selected-bytes path there is nothing to open until the bytes arrive, so
 * the context is created by the first `openSelectedBytes` and then fixed. A
 * second one is refused rather than replacing the connection: a client that
 * wants to open another file constructs another Worker, which is the same rule
 * the crash path follows, and it keeps "which file is this connection" a
 * question with one answer for the Worker's whole life.
 */
let selectedBytesContext: ArqfsWorkerContext | null = null;

async function openSelectedBytesContext(bytes: Uint8Array): Promise<ArqfsWorkerContext> {
  const sqlite3 = await sqlite3Module();
  const db = openSelectedBytesReadOnly(
    sqlite3 as unknown as Sqlite3DeserializeModule,
    bytes,
  ) as unknown as Sqlite3Oo1DatabaseLike;
  return {
    driver: createSqliteWasmArqfsDriver(db),
    // Named for what it is, so a reader of the evidence artifact cannot mistake
    // it for a persisted database: no VFS is installed on this path at all.
    usedVfs: 'memory-selected-bytes-readonly',
    session: createArqfsWorkerSession(),
    source: 'selected-bytes',
  };
}

function refuse(id: number, error: string): ArqfsWorkerResponse {
  return { id, ok: false, code: ARQFS_WORKER_ERROR_CODES.unexpected, error };
}

async function resolveContext(request: ArqfsWorkerRequest): Promise<ArqfsWorkerContext> {
  if (source === 'owned-project') {
    if (request.type === 'openSelectedBytes') {
      throw new Error(
        'this arqfs Worker owns a project file; construct it with "?source=selected-bytes" to open selected bytes',
      );
    }
    return await ownedProjectContext!;
  }
  if (request.type === 'openSelectedBytes') {
    if (selectedBytesContext !== null) {
      throw new Error(
        'this arqfs Worker already holds selected bytes; construct a new Worker to open another file',
      );
    }
    selectedBytesContext = await openSelectedBytesContext(request.bytes);
    return selectedBytesContext;
  }
  if (selectedBytesContext === null) {
    throw new Error('send openSelectedBytes before any other request on a selected-bytes Worker');
  }
  return selectedBytesContext;
}

self.onmessage = async (event: MessageEvent<ArqfsWorkerRequest>) => {
  try {
    const context = await resolveContext(event.data);
    // The bytes have already become this context's connection, so what the shared
    // handler is asked for is an ordinary open - measured against
    // `context.source`, which is what decides that it may not create a schema and
    // may not write.
    const request: ArqfsWorkerRequest =
      event.data.type === 'openSelectedBytes' ? { id: event.data.id, type: 'open' } : event.data;
    const response = handleArqfsWorkerRequest(context, request);
    if (event.data.type === 'close' && response.ok && source === 'selected-bytes') {
      // The connection and its deserialized pages are gone, so the context must
      // go with them. A later request then says so plainly instead of running
      // against a closed driver.
      selectedBytesContext = null;
    }
    self.postMessage(response);
  } catch (error) {
    // Reached for a Worker-construction or mode mistake that will never resolve on
    // retry (missing/invalid project id, wrong mode for the request, bytes that are
    // not a database at all) - every request gets a clear, immediate error instead
    // of silently hanging until the client's own timeout.
    self.postMessage(refuse(event.data.id, error instanceof Error ? error.message : String(error)));
  }
};
