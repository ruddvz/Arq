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
  | { readonly status: 'migrated' }
  | {
      readonly status: 'rejected';
      readonly reason: string;
      /**
       * Where the failed copy was kept, when `quarantineTarget` preserved it.
       * Absent when it was removed, or when neither option was supplied and it
       * is still sitting at the original target path.
       */
      readonly quarantinedAt?: string;
    };

export interface ArqfsMigrationOptions {
  /**
   * Removes the half-migrated target after a rejection. Optional because this
   * module has no filesystem of its own (see `openDriver` above) - a Node caller
   * passes `rmSync`, an OPFS caller removes its own file handle. Without it a
   * failed migration leaves debris that also makes the obvious retry fail with
   * `target-exists`, so callers that can clean up should.
   */
  readonly removeTarget?: (targetPath: string) => void;
  /**
   * Moves the half-migrated target aside and returns where it went, instead of
   * deleting it. Preferred over `removeTarget` when the caller can afford the
   * space, and takes precedence when both are supplied.
   *
   * A rejection here means the migration produced a copy that would not reopen
   * cleanly or failed SQLite's own integrity check - that is, this build just
   * corrupted a copy of a real user project while upgrading it. That copy is
   * the entire evidence of the bug: the source is untouched by design, so
   * re-running the migration only reproduces the failure if the fault was
   * deterministic, and a partial-write or environment-dependent fault leaves
   * nothing at all to examine. `removeTarget` destroys it at exactly the moment
   * it becomes valuable. Quarantining keeps the evidence while still clearing
   * the target path, so the obvious retry no longer fails with `target-exists`.
   */
  readonly quarantineTarget?: (targetPath: string) => string;
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
  // that refuse to unlink or rename an open file.
  if (result.status === 'rejected') {
    if (options.quarantineTarget !== undefined) {
      try {
        const quarantinedAt = options.quarantineTarget(targetPath);
        return { ...result, quarantinedAt };
      } catch {
        // Preserving the evidence is best effort, and failing to preserve it
        // must not turn a reported rejection into a thrown one. The rejection
        // is returned below without a quarantine path, which is the honest
        // report: the caller is told the migration failed and not told the
        // copy was kept.
      }
    } else if (options.removeTarget !== undefined) {
      try {
        options.removeTarget(targetPath);
      } catch {
        // Cleanup is best effort: the migration already failed, and the source - the
        // only copy that matters - was never modified.
      }
    }
  }

  return result;
}
