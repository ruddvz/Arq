import type { ArqfsDriver } from './arqfs-driver';
import { createArqfsSchemaV1 } from './arqfs-schema';
import { createArqfsSchemaLatest } from './arqfs-schema-v2';
import { openArqfs, type ArqfsOpenResult } from './arqfs-open';
import { applyDefensiveOpenPolicy } from './arqfs-defensive-open';
import { putArchiveEntries, getArchiveEntry, listArchiveEntryPaths } from './arqfs-archive-store';
import { buildArqfsRecoveryReport } from './arqfs-recovery-report';
import { readWorkingCopyState, type ArqfsWorkingCopyState } from './arqfs-working-copy';
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

/**
 * Where this connection's database came from, which decides two things no
 * per-request argument should be able to override.
 *
 * `owned-project` is a database this build created and owns in its own storage:
 * an untouched one may be initialised with the current schema, and a file whose
 * version floors permit writing may be written.
 *
 * `selected-bytes` is a copy of a file the user handed to this build. It is
 * inspected, never authored: no schema is created over it (an empty or foreign
 * file must be refused, not silently turned into an Arq project), the connection
 * is hardened before the file's own schema content is queried at all, and every
 * write is refused whatever the file's version floors say.
 */
export type ArqfsWorkerSource = 'owned-project' | 'selected-bytes';

export interface ArqfsWorkerContext {
  readonly driver: ArqfsDriver;
  /** Which VFS actually opened this driver ('opfs-sahpool', or an honest fallback description) - see workers/arqfs-worker. */
  readonly usedVfs: string;
  /** Mutated by `open`, read by every write. Required, because a gate that can be skipped by omitting an argument is not a gate. */
  readonly session: ArqfsWorkerSession;
  /** Defaults to 'owned-project' so an existing caller keeps its behaviour; the read-only path opts in explicitly. */
  readonly source?: ArqfsWorkerSource;
}

function refuse(id: number, code: ArqfsWorkerErrorCode, error: string): ArqfsWorkerResponse {
  return { id, ok: false, code, error };
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
  source: ArqfsWorkerSource,
): { readonly code: ArqfsWorkerErrorCode; readonly error: string } | null {
  // Checked before the open result, because this refusal does not depend on
  // anything the file says about itself. A selected file is an immutable input
  // even when it is a perfectly healthy project this build could otherwise write.
  if (source === 'selected-bytes') {
    return {
      code: ARQFS_WORKER_ERROR_CODES.selectedSourceReadOnly,
      error:
        'This connection holds a copy of a file you selected, which this build only reads. Nothing was written.',
    };
  }
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
  const source: ArqfsWorkerSource = context.source ?? 'owned-project';
  try {
    switch (request.type) {
      case 'openSelectedBytes':
        // Handled by the Worker entry, which is the only layer that knows how to
        // turn bytes into a connection. Once it has, it delegates an ordinary
        // `open` with `source: 'selected-bytes'`, so this handler never carries a
        // request field it does not read.
        return refuse(
          request.id,
          ARQFS_WORKER_ERROR_CODES.unexpected,
          'openSelectedBytes is handled by the Worker entry, not by the shared request handler',
        );
      case 'open': {
        if (source === 'selected-bytes') {
          // Hardening first, not after openArqfs. A file this build did not write
          // can carry its own schema content - views, triggers, check constraints -
          // and `openArqfs` queries `arqfs_meta` and `feature_flag` by name. Applying
          // the policy afterwards left the first queries against a stranger's schema
          // running with `trusted_schema` still on. Read-only is unconditional here:
          // the connection must refuse writes before anything reads the file, not
          // once the file has been found agreeable.
          applyDefensiveOpenPolicy(context.driver, { readOnly: true });
        } else if (context.driver.pragma('application_id') === 0) {
          // application_id reads as 0 only on a database SQLite itself has never
          // touched (its own default) - safe to initialize. Any other value, right or
          // wrong, is left to openArqfs to accept or reject; this must never overwrite
          // a real conflict. A brand-new file always starts at the latest schema
          // (FP-005) - there is no reason for a file created today to start on an
          // already-superseded schema version.
          //
          // Deliberately not reached for selected bytes: an empty file, or one
          // SQLite has never written, must be reported as not an Arq project
          // rather than turned into one and then reported as openable.
          createArqfsSchemaLatest(context.driver, createArqfsSchemaV1);
        }
        const result = openArqfs(context.driver);
        context.session.openResult = result;

        if (source === 'owned-project') {
          // The connection-level hardening arqfs-defensive-open.ts was written for.
          // Until this call existed it had no non-test caller at all, which meant
          // that in the real browser runtime `PRAGMA foreign_keys` stayed off - so
          // every `REFERENCES` and `ON DELETE CASCADE` schema v1 and v2 declare was
          // inert - while `trusted_schema` stayed on for a file Arq did not write.
          // It is applied here, at open, because this is the only moment the build
          // knows whether the file may be written.
          const writable = result.status === 'opened' && result.capabilities.canWrite;
          applyDefensiveOpenPolicy(context.driver, { readOnly: !writable });
        }

        return {
          id: request.id,
          ok: true,
          payload: { kind: 'open', result, usedVfs: context.usedVfs },
        };
      }
      case 'recoveryReport': {
        return {
          id: request.id,
          ok: true,
          payload: { kind: 'recoveryReport', report: buildArqfsRecoveryReport(context.driver) },
        };
      }
      case 'readWorkingCopyState': {
        // A file with no working-copy row (or none this build can read) is a fact
        // about the file, not a transport failure: null, not a refusal.
        let state: ArqfsWorkingCopyState | null;
        try {
          state = readWorkingCopyState(context.driver);
        } catch {
          state = null;
        }
        return { id: request.id, ok: true, payload: { kind: 'readWorkingCopyState', state } };
      }
      case 'putArchiveEntries': {
        const refusal = writeRefusal(context.session, source);
        if (refusal !== null) {
          return refuse(request.id, refusal.code, refusal.error);
        }
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
        context.session.openResult = null;
        return { id: request.id, ok: true, payload: { kind: 'close' } };
      }
    }
  } catch (error) {
    return refuse(
      request.id,
      ARQFS_WORKER_ERROR_CODES.unexpected,
      error instanceof Error ? error.message : String(error),
    );
  }
}
