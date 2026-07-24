import type { ArqfsRecoveryReport } from './arqfs-recovery-report';

/**
 * ARQ-202: the decision behind opening a .arq file "safely," given its
 * ArqfsRecoveryReport - mirrors @arq/local-storage's safe-mode.ts (ARQ-147) split:
 * this module only computes a plan, it does not itself open a driver, attempt a
 * migration, or read any bytes.
 */
export interface ArqfsSafeModePlan {
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
      canOpen: false,
      openReadOnly: true,
      missingRequiredEntries: report.missingRequiredEntries,
      reason: report.openResult.reason,
    };
  }

  const { capabilities } = report.openResult;
  if (!capabilities.canRead) {
    return {
      canOpen: false,
      openReadOnly: true,
      missingRequiredEntries: report.missingRequiredEntries,
      reason: "reader format version is below this file's minReaderMajor",
    };
  }

  if (report.missingRequiredEntries.length > 0) {
    return {
      canOpen: true,
      openReadOnly: true,
      missingRequiredEntries: report.missingRequiredEntries,
      reason: `missing required archive entries: ${report.missingRequiredEntries.join(', ')}`,
    };
  }

  if (!capabilities.canWrite) {
    return {
      canOpen: true,
      openReadOnly: true,
      missingRequiredEntries: [],
      reason: "reader format version is below this file's minWriterMajor",
    };
  }

  if (capabilities.safeModeRequired) {
    return {
      canOpen: true,
      openReadOnly: true,
      missingRequiredEntries: [],
      reason: 'file reports safeModeRequired',
    };
  }

  return { canOpen: true, openReadOnly: false, missingRequiredEntries: [], reason: 'healthy' };
}
