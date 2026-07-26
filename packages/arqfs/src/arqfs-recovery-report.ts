import type { ArqfsDriver } from './arqfs-driver';
import { openArqfs, type ArqfsOpenResult } from './arqfs-open';
import { listArchiveEntryPaths } from './arqfs-archive-store';
import { checkArqfsIntegrity, type ArqfsIntegrityReport } from './arqfs-integrity';
import { readWorkingCopyState } from './arqfs-working-copy';

/**
 * ARQ-202: the canonical-tier counterpart to @arq/local-storage's recovery-report.ts
 * (ARQ-075) - same split (this module computes facts; arqfs-safe-mode.ts computes a
 * decision from them, executing nothing itself), applied to the .arq SQLite tier
 * instead of the Dexie derived-cache tier. "Required" here matches
 * @arq/project-format's own rule: manifest.json and model.json are required: a
 * missing one rejects the archive; everything else is optional-cache-like.
 */
const REQUIRED_ARCHIVE_ENTRIES = ['manifest.json', 'model.json'] as const;

export interface ArqfsRecoveryReport {
  readonly openResult: ArqfsOpenResult;
  /** Only meaningful when openResult.status === 'opened' - required entries this file is missing, structurally detected (not present in archive_entry), not by re-validating their content. */
  readonly missingRequiredEntries: readonly string[];
  readonly presentEntryCount: number;
  /** SQLite page/foreign-key health. Optional to preserve compatibility with callers constructing reports in tests. */
  readonly integrity?: ArqfsIntegrityReport;
  /** True when the durable marker shows a crash between write start and commit. */
  readonly interruptedWrite?: boolean;
}

/**
 * Builds the recovery report as data only - it does not itself decide whether to
 * open, migrate, or refuse; see arqfs-safe-mode.ts (resolveArqfsSafeModePlan) for
 * that decision.
 */
export function buildArqfsRecoveryReport(driver: ArqfsDriver): ArqfsRecoveryReport {
  const openResult = openArqfs(driver);
  if (openResult.status !== 'opened') {
    return {
      openResult,
      missingRequiredEntries: [...REQUIRED_ARCHIVE_ENTRIES],
      presentEntryCount: 0,
    };
  }

  let present = new Set<string>();
  let listingFailed = false;
  try {
    present = new Set(listArchiveEntryPaths(driver));
  } catch {
    listingFailed = true;
  }
  const missingRequiredEntries = REQUIRED_ARCHIVE_ENTRIES.filter((entry) => !present.has(entry));

  let integrity: ArqfsIntegrityReport | undefined;
  try {
    integrity = checkArqfsIntegrity(driver);
  } catch {
    integrity = {
      ok: false,
      quickCheck: ['integrity check could not be completed'],
      foreignKeyViolations: [],
    };
  }
  if (listingFailed) {
    integrity = {
      ...(integrity ?? { quickCheck: [], foreignKeyViolations: [] }),
      ok: false,
    };
  }
  let interruptedWrite = false;
  try {
    interruptedWrite = readWorkingCopyState(driver)?.localCommitState === 'writing';
  } catch {
    // A malformed working-copy row is already represented by the failed integrity
    // result when the connection can still execute PRAGMAs.
    integrity = {
      ...(integrity ?? { quickCheck: [], foreignKeyViolations: [] }),
      ok: false,
    };
  }
  return {
    openResult,
    missingRequiredEntries,
    presentEntryCount: present.size,
    integrity,
    interruptedWrite,
  };
}
