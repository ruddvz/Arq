/**
 * Whether a set of selected bytes is a *complete* Arq database, and therefore
 * safe to adopt as a project - a different question from whether it is
 * compatible, which `arqfs-preflight.ts` already answers.
 *
 * The distinction has a specific failure behind it. A write-ahead-log database
 * keeps every transaction committed since its last checkpoint in a `-wal`
 * sidecar. A browser file picker hands over exactly one file. SQLite opened
 * against the main database with that sidecar absent does not fail, does not
 * warn, and does not report anything unusual: it reads as though the log were
 * empty and returns the database as of the last checkpoint. So a user who picks
 * `project.arq` can be shown a compatible, accepted, apparently healthy project
 * that is silently missing their most recent saved work.
 *
 * Preflight reports the dependency; this module decides what to do about it, and
 * the decision is refusal. The alternative previously in the product - open it
 * and show a caution - fails the invariant that a rejected or incomplete source
 * must not become the active project, because by the time the caution is read
 * the stale project is already on screen and indistinguishable from the real
 * one. Refusing costs the user a sentence explaining how to checkpoint the file;
 * accepting can cost them work they believe is saved.
 *
 * Deliberately derived from bytes and nothing else. The native project host runs
 * this itself rather than trusting a completeness flag handed down from the UI:
 * a caller that has not looked at the bytes must not be able to assert that they
 * are complete.
 */
import {
  preflightArqfsBytes,
  type ArqfsBytePreflightResult,
  type ArqfsPreflightPolicy,
  type ArqfsJournalMode,
  DEFAULT_ARQFS_PREFLIGHT_POLICY,
} from './arqfs-preflight';

export const ARQFS_SOURCE_COMPLETENESS_CODES = {
  /**
   * The bytes are a valid Arq database whose newest commits may live in a `-wal`
   * sidecar that was not supplied. Not corruption - incompleteness.
   */
  walSidecarRequired: 'ARQ_WAL_SIDECAR_REQUIRED',
} as const;

/**
 * What a user has to actually do about a refusal, in product terms rather than
 * SQLite terms. Kept next to the code because a refusal a user cannot act on is
 * only marginally better than a silent stale open.
 */
export const ARQFS_WAL_SIDECAR_REQUIRED_REASON =
  'This database depends on a companion "-wal" file that was not included, so it may be missing the newest saved work. Reopen the project in the application that created it and close it cleanly, which folds the companion file back into the database, then choose the database again.';

export type ArqfsSourceCompletenessResult =
  | {
      readonly status: 'complete';
      /** Carried through so a caller that needs the header facts does not re-read the bytes. */
      readonly preflight: Extract<ArqfsBytePreflightResult, { status: 'accepted' }>;
      readonly journalMode: ArqfsJournalMode;
    }
  | { readonly status: 'rejected'; readonly code: string; readonly reason: string };

/**
 * Runs byte preflight and then applies the completeness policy on top of it.
 *
 * A preflight rejection is passed through with its own code rather than
 * flattened into a generic failure: `ARQ_FILE_TRUNCATED` and
 * `ARQ_APPLICATION_ID_MISMATCH` are different problems with different user
 * remedies, and the open path needs to be able to tell them apart.
 */
export function evaluateArqfsSourceCompleteness(
  bytes: Uint8Array,
  policy: ArqfsPreflightPolicy = DEFAULT_ARQFS_PREFLIGHT_POLICY,
): ArqfsSourceCompletenessResult {
  const preflight = preflightArqfsBytes(bytes, policy);
  if (preflight.status === 'rejected') {
    return { status: 'rejected', code: preflight.code, reason: preflight.reason };
  }
  if (preflight.sidecarDependency === 'write-ahead-log-sidecar') {
    return {
      status: 'rejected',
      code: ARQFS_SOURCE_COMPLETENESS_CODES.walSidecarRequired,
      reason: ARQFS_WAL_SIDECAR_REQUIRED_REASON,
    };
  }
  return { status: 'complete', preflight, journalMode: preflight.journalMode };
}
