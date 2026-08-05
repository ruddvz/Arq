import type { ArqfsDriver } from './arqfs-driver';
import { createArqfsSchemaV1 } from './arqfs-schema';
import { createArqfsSchemaLatest } from './arqfs-schema-v2';
import { openArqfs, type ArqfsOpenResult } from './arqfs-open';
import { applyDefensiveOpenPolicy } from './arqfs-defensive-open';
import { putArchiveEntries, getArchiveEntry, listArchiveEntryPaths } from './arqfs-archive-store';
import { checkArqfsIntegrity } from './arqfs-integrity';
import {
  preflightArqfsBytes,
  DEFAULT_ARQFS_PREFLIGHT_POLICY,
  type ArqfsPreflightPolicy,
} from './arqfs-preflight';
import {
  ARQFS_WORKER_ERROR_CODES,
  type ArqfsWorkerErrorCode,
  type ArqfsWorkerRequest,
  type ArqfsWorkerResponse,
} from './arqfs-worker-protocol';

/**
 * What the last `open` decided, carried across requests.
 *
 * The worker is a connection, not a pure function: `open` establishes what this
 * build is allowed to do with this file, and every later request has to be
 * measured against that. Holding the decision in an explicit session - rather
 * than re-deriving it per request or, as before, not consulting it at all -
 * makes the write gate impossible to skip and straightforward to test.
 */
export interface ArqfsWorkerSession {
  openResult: ArqfsOpenResult | null;
  /**
   * Whether this session has been closed. Separate from `openResult` being null,
   * which is also the state of a session that has never opened: an import is
   * legal on the second and not on the first, because after `close` the driver
   * this context holds is gone and there is nothing left to replace.
   */
  closed: boolean;
}

export function createArqfsWorkerSession(): ArqfsWorkerSession {
  return { openResult: null, closed: false };
}

export interface ArqfsWorkerContext {
  /**
   * Not readonly, because `importDatabase` genuinely replaces the database this
   * Worker is connected to: the old connection is closed and a new one is opened
   * over the imported bytes. Modelling that as a swapped field keeps the
   * replacement visible instead of hiding it behind a driver that silently
   * points somewhere else than it did a moment ago.
   */
  driver: ArqfsDriver;
  /** Which VFS actually opened this driver ('opfs-sahpool', or an honest fallback description) - see workers/arqfs-worker. */
  readonly usedVfs: string;
  /**
   * The project this Worker was constructed for, echoed on every response. OPFS
   * is shared at the origin, so a client holding two Workers during a project
   * switch cannot otherwise tell whose answer it just received.
   */
  readonly projectId: string;
  /** Mutated by `open`, read by every write. Required, because a gate that can be skipped by omitting an argument is not a gate. */
  readonly session: ArqfsWorkerSession;
  /**
   * Replaces the working database with the given bytes and returns a driver over
   * the result. Storage-specific, so it is supplied by whoever built the context
   * rather than implemented here; omitted when the backend cannot do it at all
   * (an in-memory fallback with no OPFS), in which case an import is refused
   * rather than quietly accepted into storage that will not survive.
   */
  readonly importDatabase?: (bytes: Uint8Array) => ArqfsDriver;
  /** Bounds applied to imported source bytes. Defaults to the shared preflight policy. */
  readonly preflightPolicy?: ArqfsPreflightPolicy;
}

function refuse(
  context: ArqfsWorkerContext,
  id: number,
  code: ArqfsWorkerErrorCode,
  error: string,
): ArqfsWorkerResponse {
  return { id, projectId: context.projectId, ok: false, code, error };
}

/**
 * Whether this session may write, and if not, why not.
 *
 * `openArqfs` already decides this: `canWrite` is false when the file's
 * `min_writer_major` is above this build, and `safeModeRequired` is set when the
 * file could not be fully understood. Until this check existed the handler asked
 * for that decision on `open` and then ignored it - `putArchiveEntries` called
 * straight through to the store, so a file this build had just declared itself
 * unqualified to write could be mutated by the very next message.
 */
function writeRefusal(
  session: ArqfsWorkerSession,
): { readonly code: ArqfsWorkerErrorCode; readonly error: string } | null {
  const result = session.openResult;
  if (result === null) {
    return {
      code: ARQFS_WORKER_ERROR_CODES.notOpened,
      error: 'Open the file before writing to it. Nothing was written.',
    };
  }
  if (result.status === 'rejected') {
    return {
      code: ARQFS_WORKER_ERROR_CODES.openRejected,
      error: `This file was not opened: ${result.reason}. Nothing was written.`,
    };
  }
  if (!result.capabilities.canWrite) {
    return {
      code: ARQFS_WORKER_ERROR_CODES.notWritable,
      error:
        'This build can read this file but must not write it, because the file requires a newer writer. Nothing was written.',
    };
  }
  if (result.capabilities.safeModeRequired) {
    return {
      code: ARQFS_WORKER_ERROR_CODES.notWritable,
      error:
        'This file opened in safe mode, so this build does not fully understand its contents. Nothing was written.',
    };
  }
  return null;
}

/**
 * Whether this session may read, and if not, why not.
 *
 * The write gate had a matching hole on the read side: `getArchiveEntry` and
 * `listArchiveEntryPaths` called straight through to the store, so a caller could
 * read a file's contents before any `open` had run. That is not a smaller problem
 * than the write one. Before `open` there is no accepted decision about the file
 * at all, and `applyDefensiveOpenPolicy` has not run - so the read happens with
 * `trusted_schema` still on, against a database this build has not established is
 * an Arq file rather than someone else's SQLite carrying hostile schema triggers.
 * A file `open` rejected, or opened only in safe mode because its contents could
 * not be understood, is refused for the same reason: reading it hands the caller
 * bytes this build has already said it cannot interpret.
 */
function readRefusal(
  session: ArqfsWorkerSession,
): { readonly code: ArqfsWorkerErrorCode; readonly error: string } | null {
  const result = session.openResult;
  if (result === null) {
    return {
      code: ARQFS_WORKER_ERROR_CODES.notOpened,
      error: 'Open the file before reading from it. Nothing was read.',
    };
  }
  if (result.status === 'rejected') {
    return {
      code: ARQFS_WORKER_ERROR_CODES.openRejected,
      error: `This file was not opened: ${result.reason}. Nothing was read.`,
    };
  }
  if (!result.capabilities.canRead || result.capabilities.safeModeRequired) {
    return {
      code: ARQFS_WORKER_ERROR_CODES.notReadable,
      error:
        'This file opened in safe mode, so this build does not fully understand its contents. Nothing was read.',
    };
  }
  return null;
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
      case 'importDatabase': {
        // Only ever on a fresh session. After `open` there is a decision about a
        // specific file that every later request is measured against, and after
        // `close` there is no connection left to replace - accepting an import in
        // either state would leave the session describing a database that is not
        // the one it is talking to.
        if (context.session.closed) {
          return refuse(
            context,
            request.id,
            ARQFS_WORKER_ERROR_CODES.importNotAllowed,
            'This session is closed. Nothing was imported.',
          );
        }
        if (context.session.openResult !== null) {
          return refuse(
            context,
            request.id,
            ARQFS_WORKER_ERROR_CODES.importNotAllowed,
            'Import the source before opening it. This session has already opened a database, and nothing was imported.',
          );
        }
        const importDatabase = context.importDatabase;
        if (importDatabase === undefined) {
          return refuse(
            context,
            request.id,
            ARQFS_WORKER_ERROR_CODES.importUnsupported,
            'This context has no persistent storage to import into. Nothing was imported.',
          );
        }
        // Byte preflight before the bytes reach a SQLite connection at all, with
        // the same policy the main thread's own file-open gate uses: a caller
        // that skipped it, or a transport that corrupted the bytes on the way, is
        // caught here rather than inside the VFS.
        const preflight = preflightArqfsBytes(
          request.bytes,
          context.preflightPolicy ?? DEFAULT_ARQFS_PREFLIGHT_POLICY,
        );
        if (preflight.status === 'rejected') {
          return refuse(
            context,
            request.id,
            ARQFS_WORKER_ERROR_CODES.sourceRejected,
            `${preflight.code}: ${preflight.reason} Nothing was imported.`,
          );
        }
        context.driver = importDatabase(request.bytes);
        return {
          id: request.id,
          projectId: context.projectId,
          ok: true,
          payload: {
            kind: 'importDatabase',
            sidecarDependency: preflight.sidecarDependency,
            byteLength: request.bytes.byteLength,
          },
        };
      }
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
        context.session.openResult = result;

        // The connection-level hardening arqfs-defensive-open.ts was written for.
        // Until this call existed it had no non-test caller at all, which meant
        // that in the real browser runtime `PRAGMA foreign_keys` stayed off - so
        // every `REFERENCES` and `ON DELETE CASCADE` schema v1 and v2 declare was
        // inert - while `trusted_schema` stayed on for a file Arq did not write.
        // It is applied here, at open, because this is the only moment the build
        // knows whether the file may be written.
        const writable = result.status === 'opened' && result.capabilities.canWrite;
        applyDefensiveOpenPolicy(context.driver, { readOnly: !writable });

        return {
          id: request.id,
          projectId: context.projectId,
          ok: true,
          payload: { kind: 'open', result, usedVfs: context.usedVfs },
        };
      }
      case 'putArchiveEntries': {
        const refusal = writeRefusal(context.session);
        if (refusal !== null) {
          return refuse(context, request.id, refusal.code, refusal.error);
        }
        putArchiveEntries(context.driver, new Map(request.entries));
        return {
          id: request.id,
          projectId: context.projectId,
          ok: true,
          payload: { kind: 'putArchiveEntries' },
        };
      }
      case 'checkIntegrity': {
        const refusal = readRefusal(context.session);
        if (refusal !== null) {
          return refuse(context, request.id, refusal.code, refusal.error);
        }
        return {
          id: request.id,
          projectId: context.projectId,
          ok: true,
          payload: { kind: 'checkIntegrity', report: checkArqfsIntegrity(context.driver) },
        };
      }
      case 'getArchiveEntry': {
        const refusal = readRefusal(context.session);
        if (refusal !== null) {
          return refuse(context, request.id, refusal.code, refusal.error);
        }
        const content = getArchiveEntry(context.driver, request.path);
        return {
          id: request.id,
          projectId: context.projectId,
          ok: true,
          payload: { kind: 'getArchiveEntry', content },
        };
      }
      case 'listArchiveEntryPaths': {
        const refusal = readRefusal(context.session);
        if (refusal !== null) {
          return refuse(context, request.id, refusal.code, refusal.error);
        }
        const paths = listArchiveEntryPaths(context.driver);
        return {
          id: request.id,
          projectId: context.projectId,
          ok: true,
          payload: { kind: 'listArchiveEntryPaths', paths },
        };
      }
      case 'close': {
        context.driver.close();
        context.session.openResult = null;
        context.session.closed = true;
        return {
          id: request.id,
          projectId: context.projectId,
          ok: true,
          payload: { kind: 'close' },
        };
      }
    }
  } catch (error) {
    return refuse(
      context,
      request.id,
      ARQFS_WORKER_ERROR_CODES.unexpected,
      error instanceof Error ? error.message : String(error),
    );
  }
}
