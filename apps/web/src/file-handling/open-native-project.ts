import {
  runNativeOpen,
  type NativeOpenResult,
  type StagedNativeProject,
} from '@arq/project-loading';
import type { ArqfsBytePreflightResult } from '@arq/arqfs/src/arqfs-preflight';
import { evaluateSelectedFile } from './evaluate-selected-file';
import {
  createArqfsSelectedBytesSession,
  type ArqfsWorkerFactory,
  type ArqfsSelectedBytesSession,
} from './arqfs-worker-transport';

/**
 * One user action - "open this file" - from bytes to a project the workspace can
 * be given, or to a refusal that says why.
 *
 * The whole point of this module is what it does on failure. Every path that
 * leaves this function terminates the Worker it created, and no path mutates
 * anything the caller already has: the result is a *staged* project, and it is
 * the caller that decides to make it active. That is what makes replacing an
 * open project safe - the project already on screen is never touched by an
 * attempt that does not finish.
 *
 * Ordering that is not incidental:
 *
 *  - the file is read and preflighted on the main thread, before any Worker
 *    exists, so a file that is not an Arq project costs nothing and reaches no
 *    SQLite at all;
 *  - the bytes are transferred to the Worker afterwards, so nothing on the main
 *    thread holds a second copy of a large project;
 *  - the source `File` is never written to, and the Worker it is handed to has no
 *    write path (see arqfs-worker-handler.ts's `selected-bytes` source).
 */
export type NativeOpenAttempt =
  | {
      readonly status: 'opened';
      readonly fileName: string;
      readonly staged: StagedNativeProject;
      /** Live until the caller closes the project: archive reads still go through it. */
      readonly session: ArqfsSelectedBytesSession;
      readonly preflight: ArqfsBytePreflightResult | undefined;
    }
  | {
      readonly status: 'failed';
      readonly fileName: string;
      readonly code: string;
      readonly reason: string;
      /** Present when the failure happened after the file was recognised as a project. */
      readonly result: NativeOpenResult | null;
    }
  | {
      /** Not a native project: the caller routes this to import review instead. */
      readonly status: 'needs-import';
      readonly fileName: string;
      readonly formatId: string;
    };

export interface OpenNativeProjectOptions {
  readonly file: File;
  readonly createWorker: ArqfsWorkerFactory;
  /** Correlates the attempt's progress records; the caller supplies it so it can be logged first. */
  readonly attemptId: string;
}

export async function openNativeProject(
  options: OpenNativeProjectOptions,
): Promise<NativeOpenAttempt> {
  const { file, createWorker, attemptId } = options;
  const fileName = file.name;

  let bytes: Uint8Array;
  try {
    bytes = new Uint8Array(await file.arrayBuffer());
  } catch (error) {
    return {
      status: 'failed',
      fileName,
      code: 'READ_FAILED',
      reason: error instanceof Error ? error.message : String(error),
      result: null,
    };
  }

  const { route, preflight } = evaluateSelectedFile(bytes, fileName, file.type || undefined);
  if (route.kind === 'reject') {
    return { status: 'failed', fileName, code: route.code, reason: route.detail, result: null };
  }
  if (route.kind === 'import') {
    return { status: 'needs-import', fileName, formatId: route.formatId };
  }
  if (preflight?.status === 'rejected') {
    return {
      status: 'failed',
      fileName,
      code: preflight.code,
      reason: preflight.reason,
      result: null,
    };
  }

  const session = createArqfsSelectedBytesSession(createWorker, bytes);
  let result: NativeOpenResult;
  try {
    result = await runNativeOpen({ attemptId, transport: session.transport });
  } catch (error) {
    // A transport-level fault: a Worker that could not start, crashed, or timed
    // out. The pipeline's own refusals are results, not exceptions.
    session.dispose();
    return {
      status: 'failed',
      fileName,
      code: 'WORKER_FAILED',
      reason: error instanceof Error ? error.message : String(error),
      result: null,
    };
  }

  if (result.status === 'failed') {
    session.dispose();
    return { status: 'failed', fileName, code: result.code, reason: result.reason, result };
  }

  // The session stays alive on success only: the project's archive entries are
  // still readable through it, and closing the project is what disposes it.
  return { status: 'opened', fileName, staged: result, session, preflight };
}
