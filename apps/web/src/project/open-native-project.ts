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
import {
  describeEntryDigestFailure,
  verifyEntryDigestsOfEntries,
} from '@arq/arqfs/src/arqfs-entry-digests';
import { semanticHashOfEntries } from '@arq/arqfs/src/arqfs-semantic-hash';
import {
  acquireSingleWriterLock,
  describeReadOnlyReason,
  type ArqfsWriterLease,
} from '@arq/arqfs/src/arqfs-single-writer-lock';
import type { ArqfsOpenResult } from '@arq/arqfs/src/arqfs-open';
import { ArqfsWorkerClient } from '@arq/arqfs/src/arqfs-worker-client';
import { describeOpenCondition, resolveNativeOpenCapabilities } from './native-open-policy';
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
  /**
   * The chosen file is the project already open. Not an error and not a second
   * open: the working copy is content-addressed, so the same bytes name the same
   * OPFS file, and the session holding it is the one the reader already has.
   *
   * Constructing a second Worker for it is what used to happen, and it failed -
   * the new Worker cannot take a working copy the live one still holds, so
   * choosing the open project again reported "could not be opened" about a
   * project sitting on screen. Answering honestly is both correct and cheaper
   * than tearing down a session to rebuild it identically.
   */
  | { readonly status: 'already-open'; readonly workingCopyId: string }
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
  readonly onWorkerOpened: (
    writable: boolean,
    /** Set when this context lost the writer lock, which is not the file's doing. */
    lockReason: 'another-window-is-editing' | null,
  ) => void;
  readonly onHydrateStart: () => void;
}

export async function openNativeProject(
  bytes: Uint8Array,
  createWorker: NativeWorkerFactory,
  displayName: string,
  progress?: NativeOpenProgress,
  /**
   * The working copy the caller already holds open, if any. Passed in rather
   * than discovered here because ownership of the live session belongs to the
   * workspace, and this function must not reach into it.
   */
  activeWorkingCopyId?: string | null,
  /**
   * Asks to be this project's writer. Injected so the pipeline is testable
   * without `navigator.locks`, which jsdom does not provide - the real
   * implementation already degrades to a read-only lease when it is absent, so
   * an un-injected test would silently exercise only that branch.
   */
  acquireWriterLease: (options: {
    readonly projectId: string;
  }) => Promise<ArqfsWriterLease> = acquireSingleWriterLock,
): Promise<NativeOpenResult> {
  // Byte checks first: no Worker, no OPFS, nothing to clean up if these refuse.
  const completeness = evaluateArqfsSourceCompleteness(bytes);
  if (completeness.status === 'rejected') {
    return rejected(completeness.code, completeness.reason);
  }

  const workingCopyId = await workingCopyIdForBytes(bytes);
  // Checked before any Worker exists, for the same reason byte preflight is: a
  // question answerable without constructing anything must not construct
  // anything, and here constructing would actively fail.
  if (workingCopyId === activeWorkingCopyId) {
    return { status: 'already-open', workingCopyId };
  }
  // V3-030. ADR-0024's one-active-writer rule, finally asked for.
  // `acquireSingleWriterLock` was written, tested and exported, and had no
  // caller outside its own tests - so `readOnly` was decided purely by the
  // file's writer-version floor, and two tabs could open the same project
  // writable, each believing it was the writer.
  //
  // Keyed on the working copy id because that is what actually contends: the
  // Worker is constructed with it (`createWorker(workingCopyId)`), which is what
  // `opfsFilenameForProject` scopes the OPFS file by. The lock module requires
  // the lock name to match that scoping exactly, and here it does.
  //
  // Taken before the Worker exists, for the same reason the byte checks run
  // before it: a project another context is already writing should not first be
  // imported into a working copy that context holds.
  const lease = await acquireWriterLease({ projectId: workingCopyId });
  const writerLocked = lease.status !== 'writer';

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
    /*
     * The file's condition, which until now nothing asked for. `openArqfs`
     * says what the format permits; it says nothing about whether the last
     * local write reached commit or whether SQLite's own checks pass. So a
     * working copy holding a half-written revision opened fully editable, and
     * the first save committed on top of a revision the project never
     * committed to - destroying, at that moment, the only state a recovery
     * could have been built from.
     */
    const conditionWarning = describeOpenCondition(openPayload.safeMode);
    if (!openPayload.safeMode.canOpen && conditionWarning !== null) {
      return rejected('ARQ_OPEN_UNSOUND', conditionWarning);
    }

    const capabilities = resolveNativeOpenCapabilities(openResult);
    const readOnly = capabilities.readOnly || writerLocked || conditionWarning !== null;
    const warnings = [
      ...capabilities.warnings,
      ...(conditionWarning === null ? [] : [conditionWarning]),
      ...(writerLocked ? [describeReadOnlyReason(lease.reason)] : []),
    ];
    if (!openResult.capabilities.canRead) {
      return rejected('ARQ_OPEN_NOT_READABLE', capabilities.warnings[0] ?? 'Not readable.');
    }
    // The working copy exists and the database behind it opened. Reported here,
    // between the two facts, because that is where each becomes true.
    progress?.onStaged(workingCopyId);
    // Reports the whole truth about writability, which now has two independent
    // causes: the file's own writer-version floor, and whether this context won
    // the writer lock. Reporting only the first would announce a writable
    // project and then hand back a read-only one.
    progress?.onWorkerOpened(!readOnly, writerLocked ? 'another-window-is-editing' : null);
    progress?.onHydrateStart();

    // Reads are gated on the open above; a rejected or safe-mode open refuses
    // here rather than handing back bytes this build cannot interpret.
    const entriesPayload = await handle.client.request({ type: 'readAllArchiveEntries' });
    if (entriesPayload.kind !== 'readAllArchiveEntries') {
      return rejected('ARQ_READ_UNEXPECTED', 'The project did not return its contents.');
    }

    const entries = new Map(entriesPayload.entries);

    // V3-038. `checksums.json` travels inside the file and records what every
    // other entry should hash to, and until this call nothing on the open path
    // read it - publication verified a file this build had just written, while
    // open adopted a file from anywhere at all on trust. A corrupted `model.json`
    // whose digest no longer matches would decode into whatever the damaged
    // bytes happen to say and be adopted as the project.
    //
    // Refused before `importArchive`, so a file that fails its own recorded
    // digests is never parsed. Derived-entry mismatches are not fatal here for
    // the reason the module states: a thumbnail is regenerable and the project's
    // meaning is not in it.
    const digests = await verifyEntryDigestsOfEntries(entries);
    if (!digests.ok) {
      return rejected('ARQ_ENTRY_DIGEST_MISMATCH', describeEntryDigestFailure(digests));
    }

    const archive = await importArchive(entries);
    if (archive.status === 'rejected') {
      return rejected('ARQ_ARCHIVE_REJECTED', archive.reason);
    }
    const manifest = manifestOf(archive.manifest);
    if (manifest === null) {
      return rejected('ARQ_MANIFEST_INVALID', 'This project has no usable identity.');
    }
    // `views.json` comes through the same import as the model, and is what the
    // project browser's Views section lists beside the levels.
    const decoded = decodeNativeProjectModel(archive.model, archive.views);
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
      // V3-039. Computed, not verified: no manifest, schema or file records an
      // expected semantic hash, so there is nothing on disk to compare against
      // and claiming a verification here would be a claim about a check that
      // cannot run. What it is for is `@arq/derived-cache`'s freshness rule,
      // which decides whether cached geometry still describes this project by
      // comparing a stored hash against the current one - and had no source for
      // "current" on an opened project at all.
      semanticHash: await semanticHashOfEntries(entries),
      readOnly,
      usedVfs: openPayload.usedVfs,
      warnings,
    };

    const session = new NativeProjectSession(
      { client: handle.client, terminate: () => handle.worker.terminate() },
      snapshot,
      manifest,
      archive.operations,
      lease.status === 'writer' ? () => lease.handle.release() : undefined,
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
      // The lease is taken before the Worker and so outlives every failure
      // between. Not releasing it here would leave this tab holding the writer
      // lock for a project it never opened, and every other tab read-only on it.
      if (lease.status === 'writer') lease.handle.release();
    }
  }
}
