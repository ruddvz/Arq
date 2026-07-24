import type { ArqfsDriver } from './arqfs-driver';
import { openArqfs, type ArqfsOpenResult } from './arqfs-open';
import { listArchiveEntryPaths } from './arqfs-archive-store';

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

  const present = new Set(listArchiveEntryPaths(driver));
  const missingRequiredEntries = REQUIRED_ARCHIVE_ENTRIES.filter((entry) => !present.has(entry));

  return { openResult, missingRequiredEntries, presentEntryCount: present.size };
}
