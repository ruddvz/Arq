/**
 * The open-project pipeline: selected bytes in, a live project out.
 *
 * Every stage before adoption runs against an isolated candidate. Nothing here
 * touches the caller's current project until the last line, and any failure
 * terminates the Worker it created rather than leaving it holding an OPFS write
 * lock on a working copy nobody owns.
 *
 * The order is not arbitrary. Cheap byte checks run before a Worker is
 * constructed, so a truncated or non-Arq file costs nothing; the completeness
 * policy runs before anything is imported, so a database missing its `-wal`
 * sidecar is refused before it can occupy a working copy at all.
 */
import { importArchive, type ArqManifest } from '@arq/project-format';
import { evaluateArqfsSourceCompleteness } from '@arq/arqfs/src/arqfs-source-completeness';
import type { ArqfsOpenResult } from '@arq/arqfs/src/arqfs-open';
import { ArqfsWorkerClient } from '@arq/arqfs/src/arqfs-worker-client';
import { resolveNativeOpenCapabilities } from './native-open-policy';
import { decodeNativeProjectModel } from './native-project-model';
import { NativeProjectSession, type NativeProjectSnapshot } from './native-project-session';

export interface NativeWorkerHandle {
  readonly worker: Worker;
  readonly client: ArqfsWorkerClient;
}

/** Constructs a Worker bound to one project-scoped OPFS working copy. Injected so this pipeline is testable without a browser. */
export type NativeWorkerFactory = (workingCopyId: string) => NativeWorkerHandle;

export type NativeOpenResult =
  | {
      readonly status: 'opened';
      readonly session: NativeProjectSession;
      readonly snapshot: NativeProjectSnapshot;
    }
  | { readonly status: 'rejected'; readonly code: string; readonly reason: string };

function rejected(code: string, reason: string): NativeOpenResult {
  return { status: 'rejected', code, reason };
}

/**
 * A working-copy id derived from the bytes themselves, so choosing the same file
 * twice lands in the same working copy instead of accumulating orphans. Content
 * addressing rather than a random id also means the id cannot claim a project
 * identity - that claim lives in the manifest, and is checked separately.
 */
async function workingCopyIdForBytes(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', bytes as BufferSource);
  const hex = Array.from(new Uint8Array(digest).slice(0, 16))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
  return `project-${hex}`;
}

function manifestOf(value: unknown): ArqManifest | null {
  if (typeof value !== 'object' || value === null) return null;
  const manifest = value as ArqManifest;
  return typeof manifest.projectId === 'string' ? manifest : null;
}

/**
 * Reported as each stage actually completes, so the flow's lifecycle states
 * describe work that has happened rather than being replayed in a burst once
 * everything is already done. A caller that emitted them all at the end would
 * satisfy the state machine while telling the user a story - the opposite of
 * the rule the lifecycle exists to enforce.
 */
export interface NativeOpenProgress {
  readonly onStaged: (projectId: string) => void;
  readonly onWorkerOpened: (writable: boolean) => void;
  readonly onHydrateStart: () => void;
}

export async function openNativeProject(
  bytes: Uint8Array,
  createWorker: NativeWorkerFactory,
  displayName: string,
  progress?: NativeOpenProgress,
): Promise<NativeOpenResult> {
  // Byte checks first: no Worker, no OPFS, nothing to clean up if these refuse.
  const completeness = evaluateArqfsSourceCompleteness(bytes);
  if (completeness.status === 'rejected') {
    return rejected(completeness.code, completeness.reason);
  }

  const workingCopyId = await workingCopyIdForBytes(bytes);
  const handle = createWorker(workingCopyId);
  // Every failure past this point has a Worker to release. A leaked Worker keeps
  // the OPFS write lock on its working copy, which makes the project unopenable
  // for the rest of the session - so this is a finally, not a happy-path call.
  let adopted = false;
  try {
    // The bytes are copied into the working copy; the file the user chose is
    // never opened, written or moved.
    await handle.client.request({ type: 'importDatabase', bytes });

    const openPayload = await handle.client.request({ type: 'open' });
    if (openPayload.kind !== 'open') {
      return rejected('ARQ_OPEN_UNEXPECTED', 'The project did not report an open result.');
    }
    const openResult: ArqfsOpenResult = openPayload.result;
    if (openResult.status === 'rejected') {
      return rejected('ARQ_OPEN_REJECTED', openResult.reason);
    }
    const capabilities = resolveNativeOpenCapabilities(openResult);
    if (!openResult.capabilities.canRead) {
      return rejected('ARQ_OPEN_NOT_READABLE', capabilities.warnings[0] ?? 'Not readable.');
    }
    // The working copy exists and the database behind it opened. Reported here,
    // between the two facts, because that is where each becomes true.
    progress?.onStaged(workingCopyId);
    progress?.onWorkerOpened(!capabilities.readOnly);
    progress?.onHydrateStart();

    // Reads are gated on the open above; a rejected or safe-mode open refuses
    // here rather than handing back bytes this build cannot interpret.
    const entriesPayload = await handle.client.request({ type: 'readAllArchiveEntries' });
    if (entriesPayload.kind !== 'readAllArchiveEntries') {
      return rejected('ARQ_READ_UNEXPECTED', 'The project did not return its contents.');
    }

    const archive = await importArchive(new Map(entriesPayload.entries));
    if (archive.status === 'rejected') {
      return rejected('ARQ_ARCHIVE_REJECTED', archive.reason);
    }
    const manifest = manifestOf(archive.manifest);
    if (manifest === null) {
      return rejected('ARQ_MANIFEST_INVALID', 'This project has no usable identity.');
    }
    const decoded = decodeNativeProjectModel(archive.model);
    if (decoded.status === 'rejected') {
      return rejected('ARQ_MODEL_REJECTED', decoded.reason);
    }

    const snapshot: NativeProjectSnapshot = {
      workingCopyId,
      projectId: manifest.projectId,
      // The model's own name wins over the file name: the file can be renamed on
      // disk without that being a rename of the project.
      displayName: decoded.model.projectName || displayName,
      walls: decoded.model.walls,
      document: decoded.model.document,
      journalSequence: archive.operations.length,
      readOnly: capabilities.readOnly,
      usedVfs: openPayload.usedVfs,
      warnings: capabilities.warnings,
    };

    const session = new NativeProjectSession(
      { client: handle.client, terminate: () => handle.worker.terminate() },
      snapshot,
      manifest,
      archive.operations,
    );
    adopted = true;
    return { status: 'opened', session, snapshot };
  } catch (error) {
    return rejected(
      'ARQ_OPEN_FAILED',
      error instanceof Error ? error.message : 'This project could not be opened.',
    );
  } finally {
    if (!adopted) {
      handle.client.dispose();
      handle.worker.terminate();
    }
  }
}
