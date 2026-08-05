import type { ArqfsDriver } from './arqfs-driver';
import { createArqfsSchemaV1 } from './arqfs-schema';
import { createArqfsSchemaLatest } from './arqfs-schema-v2';
import { openArqfs, type ArqfsOpenResult } from './arqfs-open';
import { applyDefensiveOpenPolicy } from './arqfs-defensive-open';
import { checkArqfsIntegrity } from './arqfs-integrity';
import { computeProjectSemanticHash } from './arqfs-semantic-hash';
import {
  putArchiveEntries,
  getArchiveEntry,
  listArchiveEntryPaths,
  readAllArchiveEntries,
} from './arqfs-archive-store';
import { publishProjectFile, recordPublicationOutcome } from './arqfs-publication';
import type { ArqfsPublicationEnvironment } from './arqfs-publication';
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
}

export function createArqfsWorkerSession(): ArqfsWorkerSession {
  return { openResult: null };
}

export interface ArqfsWorkerContext {
  readonly driver: ArqfsDriver;
  /** Which VFS actually opened this driver ('opfs-sahpool', or an honest fallback description) - see workers/arqfs-worker. */
  readonly usedVfs: string;
  /**
   * The project this Worker was constructed for, echoed on every response.
   * OPFS is shared at the origin, so a client holding two Workers during a
   * project switch cannot otherwise tell whose answer it just received.
   */
  readonly projectId: string;
  /** Mutated by `open`, read by every write. Required, because a gate that can be skipped by omitting an argument is not a gate. */
  readonly session: ArqfsWorkerSession;
  /**
   * Replaces this Worker's working copy with the given bytes. Supplied by
   * workers/arqfs-worker, which owns the sqlite-wasm pool utility that can
   * actually import into an `opfs-sahpool` database; absent in contexts backed
   * by a plain driver, where importing is meaningless and is refused rather
   * than silently ignored.
   *
   * Genuinely asynchronous, not `void`-returning fire-and-forget: the pool
   * utility's own import is asynchronous, and the handler has to know when it
   * has actually finished before it can safely tell a caller the import
  readonly importDatabase?: (bytes: Uint8Array) => Promise<void>;
  /**
   * Hands back the working copy's current bytes as a standalone file, after
   * `exportDatabase`'s handler has already checkpointed the connection. Supplied
   * by workers/arqfs-worker for the same reason `importDatabase` is: only the
   * sqlite-wasm pool utility can read a `opfs-sahpool` database's bytes back out
   * of its pool of opaque files. Absent for a context that cannot produce
   * portable bytes at all (the in-memory fallback used when OPFS is
   * unavailable), where publishing is refused rather than silently handing back
   * something that will not survive a reload.
   */
  readonly exportDatabase?: () => Promise<Uint8Array>;
  /**
   * What publication needs from this Worker's VFS: a fresh independent reader on
   * the published file, its sidecars, its size, and the bytes to hand back.
   *
   * Optional for the same reason `importDatabase` is. A context backed by a
   * plain driver has no VFS that can export a file and reopen it as a separate
   * connection, and publication without an independent reader is not
   * publication - so it is refused rather than performed unverified.
   */
  readonly publication?: {
    readonly environment: ArqfsPublicationEnvironment;
    /** The published bytes, to hand to the caller. Async for the same reason `byteLength` is. */
    readonly readTarget: (targetName: string) => Uint8Array | Promise<Uint8Array>;
    /** Removes a target this publication wrote but could not verify. */
    readonly removeTarget: (targetName: string) => void | Promise<void>;
  };
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
 * Whether this session may hand project bytes back, and if not, why not.
 *
 * The write gate above has an exact counterpart on the read side that did not
 * exist: `getArchiveEntry` and `listArchiveEntryPaths` called straight through to
 * the store without consulting the session at all. A worker holding an open
 * driver would therefore answer for a file it had never opened, and - worse -
 * for a file whose open it had just *rejected*, because rejection left the
 * driver connected and only recorded a verdict nothing on this path read.
 *
 * `safeModeRequired` is refused here as well as on write. Safe mode means this
 * build could not fully understand the file, and an entry read out of a file
 * whose semantics are not understood is not a safe value to hand to a decoder
 * that will treat it as canonical project truth.
 */
function readRefusal(
  session: ArqfsWorkerSession,
): { readonly code: ArqfsWorkerErrorCode; readonly error: string } | null {
  const result = session.openResult;
  if (result === null) {
    return {
      code: ARQFS_WORKER_ERROR_CODES.notOpened,
      error: 'Open the file before reading project entries. Nothing was read.',
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
      code: ARQFS_WORKER_ERROR_CODES.openRejected,
      error: 'This build cannot safely read the complete project semantics. Nothing was read.',
    };
  }
  return null;
}

/**
 * Pure request handling, deliberately factored out of workers/arqfs-worker's actual
 * `self.onmessage` wiring so it is unit-testable in Node against the same
 * `ArqfsDriver` interface (e.g. the better-sqlite3 driver already used by
 * arqfs-schema.test.ts) without needing a real browser Worker or sqlite-wasm at all.
 * Async because this is the postMessage RPC layer, where `arqfs-driver.ts`'s own
 * comment says asynchrony belongs ("it is the postMessage RPC one layer further
 * out that is async, not this interface"). Uniformly so, not per-request: a
 * caller that had to know which request types happen to be synchronous would be
 * coupled to an implementation detail that changes whenever one of them grows a
 * verification step - which is precisely what `publish` did.
 *
 * Never throws - every branch is caught and reported as an `ok: false` response, so a
 * single bad request cannot crash the worker's message loop. That includes a request
 * whose `type` is outside the union: see the `default` case, which is reachable
 * precisely because `request` crosses a Worker boundary and its static type is a
 * claim about the caller rather than a fact about the value.
 *
 * Asynchronous because `importDatabase` and `exportDatabase` genuinely are: both
 * cross into the sqlite-wasm pool utility, which returns Promises. This closes a
 * real defect - the Worker's own `importDatabase` used to call
 * `poolUtil.importDb(...)` without awaiting it and immediately opened a fresh
 * connection on the next line, racing the still-in-flight import. Nothing had
 * caught it because every existing capability check's payload happened to be
 * small enough, and fast enough, for the race to lose more often than it won.
 * Every other case still runs to completion synchronously inside this function;
 * making the function itself `async` costs them nothing.
 */
export async function handleArqfsWorkerRequest(
  context: ArqfsWorkerContext,
  request: ArqfsWorkerRequest,
): Promise<ArqfsWorkerResponse> {
  try {
    switch (request.type) {
      case 'importDatabase': {
        if (context.importDatabase === undefined) {
          return refuse(
            context,
            request.id,
            ARQFS_WORKER_ERROR_CODES.unexpected,
            'This Worker cannot import a database into its working copy.',
          );
        }
        // Importing replaces every byte of the working copy, so whatever a
        // previous `open` decided about the old contents describes a file that
        // no longer exists. Clearing the session forces a fresh open before any
        // read or write - otherwise the gates would be measuring the imported
        // database against the outgoing one's verdict.
        context.session.openResult = null;
        // Awaited: the import must have actually landed in storage before this
        // response tells a caller it can now `open` the file it just sent.
        await context.importDatabase(request.bytes);
        return {
          id: request.id,
          projectId: context.projectId,
          ok: true,
          payload: { kind: 'importDatabase', byteLength: request.bytes.byteLength },
        };
      }
      case 'exportDatabase': {
        // A checkpoint physically rewrites the file's pages, so this is gated
        // exactly like a write - not merely on an accepted open - even though
        // nothing about the checkpoint changes the project's canonical meaning.
        const refusal = writeRefusal(context.session);
        if (refusal !== null) {
          return refuse(context, request.id, refusal.code, refusal.error);
        }
        if (context.exportDatabase === undefined) {
          return refuse(
            context,
            request.id,
            ARQFS_WORKER_ERROR_CODES.exportUnsupported,
            'This Worker cannot hand back the working copy as portable bytes.',
          );
        }
        // Switches the connection out of WAL mode, synchronously, before the
        // pool utility reads the file's bytes back out.
        //
        // A checkpoint alone is not enough: `PRAGMA wal_checkpoint(TRUNCATE)`
        // merges pending frames back into the main file and empties the `-wal`
        // file, but leaves the database header's own write/read-version bytes
        // still declaring WAL - the exact two bytes `preflightArqfsBytes` reads
        // to decide `sidecarDependency`. Exported bytes checkpointed that way
        // still preflighted as `write-ahead-log-sidecar`, caught by feeding this
        // handler's own output back through the byte-level check it has to
        // satisfy. `journal_mode=DELETE` performs the checkpoint AND rewrites
        // the header, which is what "no WAL/SHM dependency" actually requires.
        // A no-op, not an error, for a connection already outside WAL mode.
        context.driver.exec('PRAGMA journal_mode=DELETE');
        const bytes = await context.exportDatabase();
        return {
          id: request.id,
          projectId: context.projectId,
          ok: true,
          payload: { kind: 'exportDatabase', bytes },
        };
      }
      case 'computeSemanticHash': {
        const refusal = readRefusal(context.session);
        if (refusal !== null) {
          return refuse(context, request.id, refusal.code, refusal.error);
        }
        const hash = await computeProjectSemanticHash(context.driver);
        return {
          id: request.id,
          projectId: context.projectId,
          ok: true,
          payload: { kind: 'computeSemanticHash', hash },
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
        // Gated on the same accepted open as every other read: a health report
        // about a file this build has refused to open is not a value worth
        // producing, and producing it would mean running pragmas against a
        // connection whose hardening has not been decided.
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
      case 'readAllArchiveEntries': {
        const refusal = readRefusal(context.session);
        if (refusal !== null) {
          return refuse(context, request.id, refusal.code, refusal.error);
        }
        const entries = [...readAllArchiveEntries(context.driver)];
        return {
          id: request.id,
          projectId: context.projectId,
          ok: true,
          payload: { kind: 'readAllArchiveEntries', entries },
        };
      }
      case 'publish': {
        const publication = context.publication;
        if (publication === undefined) {
          return refuse(
            context,
            request.id,
            ARQFS_WORKER_ERROR_CODES.publishUnavailable,
            'This Worker cannot publish a portable file. Nothing was written.',
          );
        }
        // Gated on the write gate, not the read gate, even though publication
        // reads. It issues a WAL checkpoint against the working project and
        // records the outcome in `publication_state`, and a build that has
        // declared itself unqualified to write this file must not do either.
        const refusal = writeRefusal(context.session);
        if (refusal !== null) {
          return refuse(context, request.id, refusal.code, refusal.error);
        }
        return await publishThroughWorker(context, publication, request);
      }
      case 'close': {
        context.driver.close();
        context.session.openResult = null;
        return {
          id: request.id,
          projectId: context.projectId,
          ok: true,
          payload: { kind: 'close' },
        };
      }
      default:
        // V3-021. TypeScript reads the cases above as exhaustive, so without
        // this the function fell off the end and returned `undefined` for any
        // `type` outside the union - and the Worker posted that, leaving the
        // caller to wait out its whole timeout. The union is only exhaustive
        // over what a well-behaved caller sends; `request` arrives from another
        // execution context. A refusal is an answer, not a hang.
        return refuse(
          (request as { readonly id: number }).id,
          ARQFS_WORKER_ERROR_CODES.malformedRequest,
          `Unrecognised request type: ${String((request as { readonly type?: unknown }).type)}. Nothing was attempted.`,
        );
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

/**
 * Runs a verified publication and reports the verdict with the bytes.
 *
 * Separate and `async` because `publishProjectFile` is, and the enclosing
 * handler's `try` is synchronous - a promise rejecting inside it would escape
 * the catch entirely and reach `self.onmessage` as an unhandled rejection,
 * which is the one way this handler's "never throws" contract could still be
 * broken. So this catches its own.
 *
 * A refusal that left bytes at the target removes them. The alternative is a
 * file sitting in the VFS that failed verification, and the next publication to
 * the same name would then be refused for `target-exists` - reporting a stale
 * failure as the reason a fresh attempt could not run. `targetWritten` is the
 * flag that says whether there is anything to remove, and it exists for exactly
 * this.
 */
async function publishThroughWorker(
  context: ArqfsWorkerContext,
  publication: NonNullable<ArqfsWorkerContext['publication']>,
  request: Extract<ArqfsWorkerRequest, { type: 'publish' }>,
): Promise<ArqfsWorkerResponse> {
  try {
    const result = await publishProjectFile(
      context.driver,
      request.targetName,
      publication.environment,
      request.expectedRevision === undefined ? {} : { expectedRevision: request.expectedRevision },
    );

    if (result.status !== 'published') {
      if (result.targetWritten) {
        try {
          await publication.removeTarget(request.targetName);
        } catch {
          // A target that cannot be removed is not worth converting a specific
          // refusal into a generic failure: the caller still needs to be told
          // why publication was refused, which is the more useful of the two.
        }
      }
      recordPublicationOutcome(context.driver, 'failed');
      return {
        id: request.id,
        projectId: context.projectId,
        ok: true,
        payload: { kind: 'publish', result, bytes: null },
      };
    }

    // Read before recording success: if the bytes cannot be handed back there is
    // nothing to publish, whatever the verification concluded.
    const bytes = await publication.readTarget(request.targetName);
    recordPublicationOutcome(context.driver, 'current');
    return {
      id: request.id,
      projectId: context.projectId,
      ok: true,
      payload: { kind: 'publish', result, bytes },
    };
  } catch (error) {
    try {
      recordPublicationOutcome(context.driver, 'failed');
    } catch {
      // The working project may itself be the thing that failed. Reporting the
      // original error matters more than recording a state against a driver
      // that is not answering.
    }
    return refuse(
      context,
      request.id,
      ARQFS_WORKER_ERROR_CODES.unexpected,
      error instanceof Error ? error.message : String(error),
    );
  }
}
