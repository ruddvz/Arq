import type { ArqfsDriver } from './arqfs-driver';

/**
 * ARQ-197: clean export through the SQLite backup mechanism. Uses `VACUUM INTO`
 * (SQLite's own single-statement clean-copy mechanism, built on the same backup
 * machinery as `sqlite3_backup_init`) rather than a raw file copy - verified directly
 * (not assumed): a source database left in WAL mode still has a `-wal` sidecar file,
 * but a `VACUUM INTO` copy has neither a `-wal` nor a `-shm` sidecar, satisfying
 * `.zeus/FAST-KERNEL.md`'s own non-negotiable ("clean export requires no WAL/SHM
 * sidecars") without hand-rolling backup-API stepping.
 *
 * `VACUUM INTO` itself refuses to overwrite an existing target file (verified
 * directly) - reported here as a `target-exists` rejection rather than an uncaught
 * exception, matching this package's "never throws for a caller-reachable failure"
 * convention.
 */
export type ArqfsCleanExportResult =
  { readonly status: 'exported' } | { readonly status: 'rejected'; readonly reason: string };

export function exportCleanArqfsCopy(
  driver: ArqfsDriver,
  targetPath: string,
): ArqfsCleanExportResult {
  try {
    driver.run('VACUUM INTO ?', [targetPath]);
    return { status: 'exported' };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      status: 'rejected',
      reason: /already exists/i.test(message) ? 'target-exists' : message,
    };
  }
}
