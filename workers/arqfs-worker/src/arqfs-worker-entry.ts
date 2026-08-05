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
  correlationIdOf,
  parseArqfsWorkerRequest,
  type ArqfsWorkerResponse,
} from '@arq/arqfs/src/arqfs-worker-protocol';
import {
  createArqfsWorkerSession,
  handleArqfsWorkerRequest,
  type ArqfsWorkerContext,
} from '@arq/arqfs/src/arqfs-worker-handler';
import { createSqliteWasmArqfsDriver, type Sqlite3Oo1DatabaseLike } from './arqfs-opfs-driver';
import {
  opfsFilenameForProject,
  readProjectIdFromWorkerSearch,
  readProjectIdOrUnknown,
} from './arqfs-project-filename';

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
    let db = new poolUtil.OpfsSAHPoolDb(databaseFilename) as unknown as Sqlite3Oo1DatabaseLike;
    let driver = createSqliteWasmArqfsDriver(db);
    return {
      // A getter, not a captured value: `importDatabase` replaces the underlying
      // database, and every later request must reach the new one. Capturing the
      // driver once would leave the handler talking to a connection whose file
      // has been overwritten.
      get driver() {
        return driver;
      },
      usedVfs: 'opfs-sahpool',
      projectId,
      session,
      /**
       * The only route a user's selected `.arq` bytes have into this Worker's
       * working copy. `opfs-sahpool` keeps databases inside a pool of opaque
       * files rather than at the filename it was handed, so nothing on the main
       * thread can place bytes where SQLite will find them - only the pool
       * utility can, and it lives here.
       *
       * The open handle is closed before importing, because importing overwrites
       * the file this connection is reading and a connection left open across
       * that is reading a database that no longer exists.
       *
       * `poolUtil.importDb` is genuinely asynchronous - it returns a Promise -
       * and this now awaits it before reopening. It did not before: the previous
       * line opened a fresh connection over the target file immediately, with no
       * guarantee the import had actually finished writing it, which is exactly
       * the kind of race a fast synthetic test payload is unlikely to lose and a
       * real project's bytes are not.
       */
      importDatabase: async (bytes: Uint8Array) => {
        db.close();
        await poolUtil.importDb(databaseFilename, bytes);
        db = new poolUtil.OpfsSAHPoolDb(databaseFilename) as unknown as Sqlite3Oo1DatabaseLike;
        driver = createSqliteWasmArqfsDriver(db);
      },
      /**
       * The other direction: hands back the working copy's current bytes,
       * called only after `exportDatabase`'s Worker-handler case has already
       * checkpointed this same connection. `exportFile` reads the pool's stored
       * bytes for this filename directly - it does not go through `db` - so the
       * live connection does not need to be closed first, unlike import.
       */
      exportDatabase: () => poolUtil.exportFile(databaseFilename),
      /**
       * What `publishProjectFile` needs from this VFS.
       *
       * Publication only means anything if the reader shares nothing with the
       * writer, and inside `opfs-sahpool` only this utility can produce one: it
       * keeps databases in a pool of opaque files, so `VACUUM INTO` writes to a
       * pool entry that nothing outside here can open. A main thread handed the
       * bytes and asked to verify them would be checking a copy of a copy, which
       * is not the property publication claims.
       */
      publication: {
        environment: {
          // A brand-new connection on the published pool entry - not `db`, and
          // not a handle derived from it.
          openFreshReader: (targetName: string) =>
            createSqliteWasmArqfsDriver(
              new poolUtil.OpfsSAHPoolDb(targetName) as unknown as Sqlite3Oo1DatabaseLike,
            ),
          /**
           * Checked against the pool's own file list rather than assumed empty.
           * `VACUUM INTO` produces a single settled database and sahpool does not
           * keep sidecars as separate entries, so this is expected to be empty -
           * but "expected empty" and "verified empty" are different claims, and
           * the one publication makes to a user is that the file travels alone.
           */
          listSidecars: (targetName: string) =>
            poolUtil
              .getFileNames()
              .filter(
                (name: string) =>
                  name === `${targetName}-wal` ||
                  name === `${targetName}-shm` ||
                  name === `${targetName}-journal`,
              ),
          byteLength: async (targetName: string) =>
            (await poolUtil.exportFile(targetName)).byteLength,
        },
        readTarget: (targetName: string) => poolUtil.exportFile(targetName),
        removeTarget: (targetName: string) => {
          poolUtil.unlink(targetName);
        },
      },
    };
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    const db = new sqlite3.oo1.DB(':memory:', 'ct') as unknown as Sqlite3Oo1DatabaseLike;
    return {
      driver: createSqliteWasmArqfsDriver(db),
      usedVfs: `memory-fallback (opfs-sahpool unavailable: ${reason})`,
      projectId,
      session,
    };
  }
}

const contextPromise = openContext();

/**
 * The one way this file posts a response.
 *
 * `self.postMessage` takes `any`, which is how an un-awaited
 * `handleArqfsWorkerRequest(...)` was posted as a *Promise* the moment that
 * function became async: `structuredClone` cannot serialise one, so nothing
 * reached the client and every request died at its timeout. tsc had no
 * objection, and the unit tests call the handler directly, so the only thing
 * that noticed was the headless-browser capability check.
 *
 * Typing the parameter is the fix. A Promise is not an `ArqfsWorkerResponse`,
 * so the same mistake now fails to compile rather than failing in a browser.
 */
function post(response: ArqfsWorkerResponse): void {
  self.postMessage(response);
}

// Requests are not serialized here: two messages arriving close together each
// invoke this handler, and `handleArqfsWorkerRequest` now genuinely awaits
// (importDatabase, exportDatabase, computeSemanticHash), so a second message
// could in principle be handled while the first is still mid-flight. Every
// caller in this codebase awaits one request before sending the next
// (`ArqfsWorkerRequestClient` callers, `NativeProjectSession`'s own write
// queue), which keeps this from being reachable today - a caller that fired
// requests without awaiting them would need this fixed first.
self.onmessage = async (event: MessageEvent<unknown>) => {
  // V3-021. `event.data` is whatever the other context posted, so it is parsed
  // rather than annotated. The old signature said `MessageEvent<ArqfsWorkerRequest>`,
  // which made the value look checked without anything having checked it.
  const request = parseArqfsWorkerRequest(event.data);
  if (request === null) {
    const id = correlationIdOf(event.data);
    // With no usable id there is nothing to correlate a refusal against, and
    // posting one under an invented id would resolve some other request. Staying
    // silent leaves only this caller to time out, which is the smaller harm.
    if (id !== null) {
      post({
        id,
        projectId: readProjectIdOrUnknown(self.location.search),
        ok: false,
        code: ARQFS_WORKER_ERROR_CODES.malformedRequest,
        error:
          'This request is not a shape the arqfs Worker protocol defines. Nothing was attempted.',
      });
    }
    return;
  }
  try {
    const context = await contextPromise;
    post(await handleArqfsWorkerRequest(context, request));
  } catch (error) {
    // contextPromise rejects only for a Worker-construction mistake (missing/invalid
    // project id) that will never resolve on retry - every request gets a clear,
    // immediate error instead of silently hanging until the client's own timeout.
    // The project id is re-read from this Worker's own URL rather than taken
    // from the context that failed to build, so the refusal still names who
    // it is from - falling back to an explicit "unknown" only when even that
    // fails, which is exactly the failure this branch exists for.
    post({
      id: request.id,
      projectId: readProjectIdOrUnknown(self.location.search),
      ok: false,
      code: ARQFS_WORKER_ERROR_CODES.unexpected,
      error: error instanceof Error ? error.message : String(error),
    });
  }
};
