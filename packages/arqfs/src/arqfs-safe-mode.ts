import type { ArqfsRecoveryReport } from './arqfs-recovery-report';

/**
 * ARQ-202: the decision behind opening a .arq file "safely," given its
 * ArqfsRecoveryReport - mirrors @arq/local-storage's safe-mode.ts (ARQ-147) split:
 * this module only computes a plan, it does not itself open a driver, attempt a
 * migration, or read any bytes.
 */
/**
 * FP-016: a structured discriminant a UI can branch on directly, instead of
 * pattern-matching substrings of `reason` (which is free text for logs/
 * diagnostics only and may reword at any time). `'unreadable'` covers both
 * ways `canOpen` can be false (wrong application ID and reader-too-old-to-read)
 * since from a caller's perspective both are simply "cannot open this file" -
 * `reason` still distinguishes them for diagnostics.
 */
export type ArqfsSafeModePlanKind =
  | 'unreadable'
  | 'corrupt'
  | 'interrupted-write'
  | 'reader-too-old-to-write'
  | 'missing-required-entries'
  | 'safe-mode-required'
  | 'healthy';

export interface ArqfsSafeModePlan {
  readonly kind: ArqfsSafeModePlanKind;
  /** False only when the file cannot be read at all (wrong application ID, or a reader major version below the file's minReaderMajor). */
  readonly canOpen: boolean;
  /** True when the file should be opened read-only - either the reader's own capabilities say so, or required content is missing/the file needs a migration this caller has not been told to run. */
  readonly openReadOnly: boolean;
  readonly missingRequiredEntries: readonly string[];
  readonly reason: string;
}

export function resolveArqfsSafeModePlan(report: ArqfsRecoveryReport): ArqfsSafeModePlan {
  if (report.openResult.status === 'rejected') {
    return {
      kind: 'unreadable',
      canOpen: false,
      openReadOnly: true,
      missingRequiredEntries: report.missingRequiredEntries,
      reason: report.openResult.reason,
    };
  }

  const { capabilities } = report.openResult;
  if (!capabilities.canRead) {
    return {
      kind: 'unreadable',
      canOpen: false,
      openReadOnly: true,
      missingRequiredEntries: report.missingRequiredEntries,
      reason: "reader format version is below this file's minReaderMajor",
    };
  }

  if (report.integrity !== undefined && !report.integrity.ok) {
    return {
      kind: 'corrupt',
      canOpen: false,
      openReadOnly: true,
      missingRequiredEntries: report.missingRequiredEntries,
      reason: 'SQLite integrity checks failed',
    };
  }

  if (report.interruptedWrite === true) {
    return {
      kind: 'interrupted-write',
      canOpen: true,
      openReadOnly: true,
      missingRequiredEntries: report.missingRequiredEntries,
      reason: 'a previous local write did not reach commit',
    };
  }

  if (report.missingRequiredEntries.length > 0) {
    return {
      kind: 'missing-required-entries',
      canOpen: true,
      openReadOnly: true,
      missingRequiredEntries: report.missingRequiredEntries,
      reason: `missing required archive entries: ${report.missingRequiredEntries.join(', ')}`,
    };
  }

  if (!capabilities.canWrite) {
    return {
      kind: 'reader-too-old-to-write',
      canOpen: true,
      openReadOnly: true,
      missingRequiredEntries: [],
      reason: "reader format version is below this file's minWriterMajor",
    };
  }

  if (capabilities.safeModeRequired) {
    return {
      kind: 'safe-mode-required',
      canOpen: true,
      openReadOnly: true,
      missingRequiredEntries: [],
      reason: 'file reports safeModeRequired',
    };
  }

  return {
    kind: 'healthy',
    canOpen: true,
    openReadOnly: false,
    missingRequiredEntries: [],
    reason: 'healthy',
  };
}

/**
 * The subset of conditions that must take write access away from an *open
 * working copy*, as opposed to describing a file someone is choosing.
 *
 * The distinction matters because `resolveArqfsSafeModePlan` answers a question
 * about a file: given everything this report says, how should it be opened. Two
 * of its answers - `missing-required-entries` and the two format-derived kinds -
 * are properties of the chosen file, and `apps/web`'s own open policy
 * (`native-open-policy.ts`) already decides what the product does about them. A
 * working copy that this build just initialised has no required entries either,
 * and it is not damaged; it is empty.
 *
 * These two are different. `corrupt` means SQLite's own checks failed on the
 * pages being read, and `interrupted-write` means a previous local write never
 * reached commit - so the current bytes describe a revision the project never
 * committed to. Writing on top of either turns a recoverable state into a
 * committed one, which is the single way an open can destroy work that was
 * still there when it started. Neither is a property of the format, so nothing
 * else in the stack refuses them.
 */
export function conditionForcesReadOnly(plan: ArqfsSafeModePlan): boolean {
  return plan.kind === 'corrupt' || plan.kind === 'interrupted-write';
}
