import type { ArqfsDriver } from './arqfs-driver';
import { exportCleanArqfsCopy } from './arqfs-clean-export';
import { openArqfs } from './arqfs-open';
import { checkArqfsIntegrity } from './arqfs-integrity';

/**
 * ARQ-201: copy-on-write migration. The source is never mutated - only read from,
 * via `exportCleanArqfsCopy`'s `VACUUM INTO` (ARQ-197). The migration transform runs
 * against the fresh copy, which is then verified (reopened and checked against
 * `openArqfs`) before this function reports success. Mirrors
 * `@arq/project-format/src/migration.ts`'s own stated division of labour: this
 * function has no opinion on *what* a migration changes (that is `applyMigration`,
 * caller-supplied, matching the existing `Migration.migrate` shape in spirit) and
 * does not perform the final "swap the canonical file" step - a caller must do that
 * once satisfied, exactly like `migration.ts`'s own doc comment already says about
 * backup/never-overwrite-the-only-copy being a caller responsibility this module
 * cannot enforce itself.
 *
 * `openDriver` is a factory rather than this module constructing one directly,
 * since "open a path" means something different for the Node driver (a filesystem
 * path string) than a future OPFS driver (its own directory-handle-based naming) -
 * this keeps the function usable by either without depending on either concretely.
 */
export type ArqfsMigrationResult =
  { readonly status: 'migrated' } | { readonly status: 'rejected'; readonly reason: string };

export interface ArqfsMigrationOptions {
  /**
   * Removes the half-migrated target after a rejection. Optional because this
   * module has no filesystem of its own (see `openDriver` above) - a Node caller
   * passes `rmSync`, an OPFS caller removes its own file handle. Without it a
   * failed migration leaves debris that also makes the obvious retry fail with
   * `target-exists`, so callers that can clean up should.
   */
  readonly removeTarget?: (targetPath: string) => void;
}

export function migrateArqfsCopyOnWrite(
  sourceDriver: ArqfsDriver,
  targetPath: string,
  openDriver: (path: string) => ArqfsDriver,
  applyMigration: (targetDriver: ArqfsDriver) => void,
  options: ArqfsMigrationOptions = {},
): ArqfsMigrationResult {
  const exportResult = exportCleanArqfsCopy(sourceDriver, targetPath);
  if (exportResult.status === 'rejected') {
    // The target here is whatever was already on disk, not something this call
    // created, so it must not be removed.
    return { status: 'rejected', reason: exportResult.reason };
  }

  const targetDriver = openDriver(targetPath);
  let result: ArqfsMigrationResult;
  try {
    applyMigration(targetDriver);
    const openResult = openArqfs(targetDriver);
    if (openResult.status !== 'opened') {
      result = {
        status: 'rejected',
        reason: 'migrated copy failed to reopen cleanly after migration',
      };
    } else if (!checkArqfsIntegrity(targetDriver).ok) {
      result = {
        status: 'rejected',
        reason: 'migrated copy failed SQLite integrity checks',
      };
    } else {
      result = { status: 'migrated' };
    }
  } catch (error) {
    result = {
      status: 'rejected',
      reason: error instanceof Error ? error.message : String(error),
    };
  } finally {
    targetDriver.close();
  }

  // Only after the driver is closed, so the handle is not still open on platforms
  // that refuse to unlink an open file.
  if (result.status === 'rejected' && options.removeTarget !== undefined) {
    try {
      options.removeTarget(targetPath);
    } catch {
      // Cleanup is best effort: the migration already failed, and the source - the
      // only copy that matters - was never modified.
    }
  }

  return result;
}
