import type { ArqfsDriver } from './arqfs-driver';
import type { ArqFormatVersion } from './arqfs-header';
import { exportCleanArqfsCopy } from './arqfs-clean-export';
import { openArqfs } from './arqfs-open';
import { checkArqfsIntegrity } from './arqfs-integrity';
import { computeProjectSemanticHash, SEMANTIC_HASH_SCHEME } from './arqfs-semantic-hash';
import { listArchiveEntryPaths } from './arqfs-archive-store';
import { verifyArqfsEntryDigests, describeEntryDigestFailure } from './arqfs-entry-digests';
import { readWorkingCopyState } from './arqfs-working-copy';

/**
 * Portable publication: turning one exact working revision into a standalone
 * `.arq` file, and then *proving* it before anything says the word "published".
 *
 * The proof is the point. `exportCleanArqfsCopy` (arqfs-clean-export.ts) already
 * produced sidecar-free bytes, but a successful `VACUUM INTO` only says SQLite
 * wrote a file without raising. It does not say the file that landed on the disk
 * still contains this project, at this revision, with this meaning. Between the
 * export and the user handing the file to someone else sit a truncated write, a
 * full disk, a driver that buffered, a target path that was not what the caller
 * thought, and a migration or export bug that silently dropped entries. Every one
 * of those produces a file that exists and opens.
 *
 * So publication here ends by opening the published bytes through a *fresh
 * reader* - a connection that shares no page cache, no statement cache, no
 * transaction and no in-memory state with the writer - and comparing what that
 * reader independently sees against what was intended: same project identity,
 * same revision, same length-framed semantic hash, self-consistent SQLite, and no
 * required sidecars. A check that ran on the writer's own handle would be the
 * writer marking its own work, and would pass on exactly the buffered-write
 * failures this exists to catch.
 *
 * ADR-0028 and `.zeus/FAST-KERNEL.md` both put this the same way from the other
 * side: unknown is not green. An unverified publication is unknown.
 */

/**
 * What a fresh reader needs from its host to inspect bytes the writer just
 * produced. Injected rather than imported so this module stays on the same
 * runtime-agnostic seam as `ArqfsDriver` itself (arqfs-driver.ts): Node tests
 * back it with `node:fs` and better-sqlite3, and the Worker/OPFS build backs it
 * with sqlite-wasm and OPFS handles, without this file knowing which.
 */
export interface ArqfsPublicationEnvironment {
  /**
   * Opens the published file through a connection independent of the writer's.
   * Returning the writer's own driver defeats the verification, so a host must
   * open the target path anew.
   */
  readonly openFreshReader: (targetPath: string) => ArqfsDriver;
  /**
   * Paths of any WAL/SHM sidecars sitting beside the published file. A portable
   * publication that needs a sidecar is not portable: moved or shared on its
   * own, it silently loses whatever the sidecar held.
   */
  readonly listSidecars: (targetPath: string) => readonly string[];
  /** Size of the published file, recorded on the receipt as handed-over evidence. */
  readonly byteLength: (targetPath: string) => number;
}

/**
 * Why a publication was refused. Every one of these means the same two things,
 * which is why they share a result shape: no verified file was handed over, and
 * the working project on this device still holds the user's changes untouched.
 */
export type ArqfsPublicationRefusal =
  /** No working-copy row, so there is no revision to publish. */
  | 'working-copy-missing'
  /** A write was in flight or had failed. Publishing mid-write would capture a revision that was never committed. */
  | 'working-copy-not-settled'
  /** The caller asked for an exact revision the working project is not on. */
  | 'revision-not-current'
  /** `VACUUM INTO` refused, most often because the target path already exists. */
  | 'export-failed'
  /** The published bytes could not be opened at all by an independent reader. */
  | 'reader-open-failed'
  /** They opened, but not as a readable Arq file of a version this build understands. */
  | 'reader-rejected'
  /** SQLite's own consistency checks failed on the published file. */
  | 'integrity-failed'
  /** A canonical archive entry no longer hashes to its recorded digest. */
  | 'entry-digest-failed'
  /** The fresh reader found a different project than the one published. */
  | 'identity-mismatch'
  /** The fresh reader found a different revision than the one published. */
  | 'revision-drift'
  /** The fresh reader's semantic hash differs: the meaning did not survive the write. */
  | 'semantic-mismatch'
  /** The published file depends on a sidecar and cannot travel alone. */
  | 'sidecar-present';

/**
 * Evidence that one exact revision reached a portable file and was read back
 * intact. Held by the caller, deliberately *not* written into the working
 * project's archive entries: an archive entry is canonical content and would
 * change the very semantic hash the receipt attests to, so a receipt stored that
 * way could never describe the file it came from.
 */
export interface ArqfsPublicationReceipt {
  readonly projectId: string;
  readonly revision: number;
  readonly semanticHash: string;
  /** Named explicitly so a digest is never compared across hashing schemes. */
  readonly semanticHashScheme: string;
  readonly formatVersion: ArqFormatVersion;
  readonly entryCount: number;
  readonly byteLength: number;
  readonly targetPath: string;
  /** How the claim was established. Only a fresh independent reader qualifies. */
  readonly verifiedBy: 'fresh-reader';
}

export type ArqfsPublicationResult =
  | { readonly status: 'published'; readonly receipt: ArqfsPublicationReceipt }
  | {
      readonly status: 'refused';
      readonly reason: ArqfsPublicationRefusal;
      readonly detail: string;
      /**
       * Whether bytes were left at the target path. A caller cleaning up after a
       * refusal must know whether there is anything to clean up, and a user must
       * never be left believing a file that failed verification is usable.
       */
      readonly targetWritten: boolean;
    };

export interface ArqfsPublishOptions {
  /**
   * Publish only if the working project is on this revision. Omitted means
   * "whatever is current"; supplied means the caller has shown the user a
   * revision and must not silently publish a different one.
   */
  readonly expectedRevision?: number;
}

/**
 * Publishes the working project to `targetPath` and verifies the result with a
 * fresh reader. Returns `published` only when every check passed.
 *
 * This never mutates canonical content. The one statement it issues against the
 * working project is a WAL checkpoint, which moves committed pages into the main
 * database without changing what the project means - so a refusal at any step
 * leaves the working project exactly as it was, which is what lets the failure
 * copy promise the user their changes are still here.
 */
export async function publishProjectFile(
  driver: ArqfsDriver,
  targetPath: string,
  environment: ArqfsPublicationEnvironment,
  options: ArqfsPublishOptions = {},
): Promise<ArqfsPublicationResult> {
  const working = readWorkingCopyState(driver);
  if (working === null) {
    return refuse('working-copy-missing', 'the working project has no working-copy state', false);
  }
  // A publication is a claim about a committed revision. `writing` means a
  // transaction was interrupted and `failed` means one did not complete, so in
  // both the current bytes describe a revision the project never committed to.
  if (working.localCommitState !== 'clean') {
    return refuse(
      'working-copy-not-settled',
      `the working project has an unsettled local write (${working.localCommitState})`,
      false,
    );
  }
  if (
    options.expectedRevision !== undefined &&
    options.expectedRevision !== working.localRevision
  ) {
    return refuse(
      'revision-not-current',
      `revision ${options.expectedRevision} was requested but the working project is on ${working.localRevision}`,
      false,
    );
  }

  // Settle WAL content into the main database before copying. Best effort by
  // design: a database that is not in WAL mode has nothing to checkpoint, and a
  // checkpoint that cannot run is not itself a reason to refuse - the fresh
  // reader below is what actually decides whether the copy is sound.
  try {
    driver.run('PRAGMA wal_checkpoint(TRUNCATE)');
  } catch {
    // Intentionally ignored; verification is the gate, not this optimisation.
  }

  const intendedHash = await computeProjectSemanticHash(driver);
  const intendedEntryCount = listArchiveEntryPaths(driver).length;

  const exported = exportCleanArqfsCopy(driver, targetPath);
  if (exported.status === 'rejected') {
    return refuse(
      'export-failed',
      exported.reason,
      // `target-exists` means the bytes at that path are somebody else's file,
      // which this publication did not write and must not report as its own.
      false,
    );
  }

  let reader: ArqfsDriver;
  try {
    reader = environment.openFreshReader(targetPath);
  } catch (error) {
    return refuse('reader-open-failed', messageOf(error), true);
  }

  try {
    const opened = openArqfs(reader);
    if (opened.status !== 'opened') {
      return refuse('reader-rejected', opened.reason, true);
    }
    if (!opened.capabilities.canRead) {
      return refuse(
        'reader-rejected',
        opened.capabilities.unsupportedRequiredFeatures.join(', ') || 'not readable',
        true,
      );
    }

    const integrity = checkArqfsIntegrity(reader);
    if (!integrity.ok) {
      return refuse(
        'integrity-failed',
        integrity.quickCheck.join('; ') || 'integrity check failed',
        true,
      );
    }

    // Per-entry digests, checked on the fresh reader for the same reason as
    // everything else here: the writer's view of its own entries is not
    // evidence about the bytes that landed. `PRAGMA quick_check` passing says
    // the database is structurally sound, not that an entry's content survived.
    const digests = await verifyArqfsEntryDigests(reader);
    if (!digests.ok) {
      return refuse('entry-digest-failed', describeEntryDigestFailure(digests), true);
    }

    const publishedState = readWorkingCopyState(reader);
    if (publishedState === null) {
      return refuse('identity-mismatch', 'the published file has no working-copy state', true);
    }
    if (publishedState.projectId !== working.projectId) {
      return refuse(
        'identity-mismatch',
        `expected project ${working.projectId} but the published file holds ${publishedState.projectId}`,
        true,
      );
    }
    if (publishedState.localRevision !== working.localRevision) {
      return refuse(
        'revision-drift',
        `expected revision ${working.localRevision} but the published file holds ${publishedState.localRevision}`,
        true,
      );
    }

    // The strongest of the checks: the reader recomputes the length-framed hash
    // over what it can actually see, so an entry lost, truncated or reframed on
    // the way out changes this digest even when SQLite considers the file sound.
    const publishedHash = await computeProjectSemanticHash(reader);
    if (publishedHash !== intendedHash) {
      return refuse(
        'semantic-mismatch',
        `expected semantic hash ${intendedHash} but the published file hashes to ${publishedHash}`,
        true,
      );
    }

    const sidecars = environment.listSidecars(targetPath);
    if (sidecars.length > 0) {
      return refuse('sidecar-present', `published file depends on ${sidecars.join(', ')}`, true);
    }

    return {
      status: 'published',
      receipt: {
        projectId: working.projectId,
        revision: working.localRevision,
        semanticHash: publishedHash,
        semanticHashScheme: SEMANTIC_HASH_SCHEME,
        formatVersion: opened.header,
        entryCount: intendedEntryCount,
        byteLength: environment.byteLength(targetPath),
        targetPath,
        verifiedBy: 'fresh-reader',
      },
    };
  } finally {
    // The reader closes on every path, including a thrown one. A verification
    // handle left open is exactly the stale-handle leak the lifecycle's
    // repeated-open checks exist to catch.
    reader.close();
  }
}

/**
 * Records the outcome against the working project's `publication_state`, which
 * is the only thing publication is allowed to write back. Separate from
 * `publishProjectFile` so verification stays a pure read of the working project
 * and a caller can decide when - or whether - to persist the outcome.
 */
export function recordPublicationOutcome(
  driver: ArqfsDriver,
  outcome: 'current' | 'failed' | 'pending',
): void {
  const result = driver.run('UPDATE working_copy_state SET publication_state = ? WHERE id = 1', [
    outcome,
  ]);
  if (result.changes !== 1) {
    throw new Error('working copy state is not initialized');
  }
}

function refuse(
  reason: ArqfsPublicationRefusal,
  detail: string,
  targetWritten: boolean,
): ArqfsPublicationResult {
  return { status: 'refused', reason, detail, targetWritten };
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
