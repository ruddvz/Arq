import {
  closeSync,
  copyFileSync,
  existsSync,
  fsyncSync,
  openSync,
  renameSync,
  rmSync,
  statSync,
} from 'node:fs';
import path from 'node:path';
import { createNodeArqfsDriver } from './arqfs-node-driver';
import { openArqfs } from './arqfs-open';
import { checkArqfsIntegrity } from './arqfs-integrity';

/**
 * The final step `migrateArqfsCopyOnWrite` deliberately does not perform: promoting
 * a verified replacement file into the canonical path. Node-only, for the same
 * reason `arqfs-node-driver.ts` is - "replace a file atomically" is a filesystem
 * operation, not a SQLite one, and an OPFS runtime expresses it through its own
 * directory-handle API instead.
 *
 * The invariant this module exists to hold: the last committed canonical revision
 * stays recoverable no matter where the process dies. Every failure path either
 * leaves the original canonical file exactly as it was, or leaves it restorable
 * from a backup whose path is reported back to the caller.
 */
export type ArqfsFileSwapCode =
  | 'ARQ_SWAP_SAME_PATH'
  | 'ARQ_SWAP_REPLACEMENT_MISSING'
  | 'ARQ_SWAP_REPLACEMENT_INVALID'
  | 'ARQ_SWAP_BACKUP_EXISTS'
  | 'ARQ_SWAP_BACKUP_FAILED'
  | 'ARQ_SWAP_FAILED'
  | 'ARQ_SWAP_ROLLBACK_FAILED';

export type ArqfsFileSwapResult =
  | {
      readonly status: 'swapped';
      /** Where the previous canonical revision was kept, or null when it was not retained. */
      readonly backupPath: string | null;
    }
  | {
      readonly status: 'rejected';
      readonly code: ArqfsFileSwapCode;
      readonly reason: string;
      /** True when the canonical path still holds the last committed revision. */
      readonly canonicalPreserved: boolean;
      /** Set when the canonical revision survives at a backup path instead of in place. */
      readonly recoverableFrom?: string;
    };

export interface ArqfsFileSwapValidation {
  readonly ok: boolean;
  readonly reason?: string;
}

export interface ArqfsFileSwapOptions {
  /** Defaults to `<canonicalPath>.backup`. Never silently overwritten. */
  readonly backupPath?: string;
  /** Keep the backup after a successful swap. Defaults to false. */
  readonly retainBackup?: boolean;
  /**
   * Runs against the replacement before anything is moved. Defaults to
   * `validateArqfsFileForSwap`. A replacement that cannot be opened and
   * integrity-checked must never become canonical.
   */
  readonly validateReplacement?: (replacementPath: string) => ArqfsFileSwapValidation;
  /**
   * Test seam for failure injection. Called after the backup exists but before the
   * rename, and again after the rename. Throwing simulates a crash at that point.
   */
  readonly onStage?: (stage: 'after-backup' | 'after-rename') => void;
}

/** Opens the file as a real SQLite database and requires a clean arqfs open plus intact pages. */
export function validateArqfsFileForSwap(replacementPath: string): ArqfsFileSwapValidation {
  let driver;
  try {
    driver = createNodeArqfsDriver(replacementPath);
  } catch (error) {
    return { ok: false, reason: error instanceof Error ? error.message : String(error) };
  }
  try {
    const opened = openArqfs(driver);
    if (opened.status !== 'opened') {
      return { ok: false, reason: `replacement did not open cleanly: ${opened.reason}` };
    }
    const integrity = checkArqfsIntegrity(driver);
    if (!integrity.ok) {
      return { ok: false, reason: 'replacement failed SQLite integrity checks' };
    }
    return { ok: true };
  } catch (error) {
    return { ok: false, reason: error instanceof Error ? error.message : String(error) };
  } finally {
    driver.close();
  }
}

/** fsync a file so its bytes are durable before it is allowed to become canonical. */
function fsyncPath(target: string): void {
  const handle = openSync(target, 'r');
  try {
    fsyncSync(handle);
  } finally {
    closeSync(handle);
  }
}

/**
 * fsync the containing directory so the rename itself is durable. Without this the
 * directory entry can still be lost on power failure even though both files' bytes
 * were flushed. Directory fsync is not portable (it throws EPERM on some platforms,
 * notably Windows), so a failure here is not treated as a swap failure.
 */
function fsyncDirectory(target: string): void {
  try {
    fsyncPath(path.dirname(target));
  } catch {
    // Best effort by design - see above.
  }
}

const sidecarSuffixes = ['-wal', '-shm'] as const;

export function commitArqfsFileSwap(
  canonicalPath: string,
  replacementPath: string,
  options: ArqfsFileSwapOptions = {},
): ArqfsFileSwapResult {
  const resolvedCanonical = path.resolve(canonicalPath);
  const resolvedReplacement = path.resolve(replacementPath);

  // Promoting a file onto itself would destroy the only copy for no gain.
  if (resolvedCanonical === resolvedReplacement) {
    return {
      status: 'rejected',
      code: 'ARQ_SWAP_SAME_PATH',
      reason: 'replacement and canonical path are the same file',
      canonicalPreserved: true,
    };
  }

  if (!existsSync(resolvedReplacement) || !statSync(resolvedReplacement).isFile()) {
    return {
      status: 'rejected',
      code: 'ARQ_SWAP_REPLACEMENT_MISSING',
      reason: 'replacement file does not exist',
      canonicalPreserved: true,
    };
  }

  const validate = options.validateReplacement ?? validateArqfsFileForSwap;
  const validation = validate(resolvedReplacement);
  if (!validation.ok) {
    return {
      status: 'rejected',
      code: 'ARQ_SWAP_REPLACEMENT_INVALID',
      reason: validation.reason ?? 'replacement failed validation',
      canonicalPreserved: true,
    };
  }

  const backupPath = options.backupPath ?? `${resolvedCanonical}.backup`;
  const canonicalExists = existsSync(resolvedCanonical);
  if (canonicalExists && existsSync(backupPath)) {
    return {
      status: 'rejected',
      code: 'ARQ_SWAP_BACKUP_EXISTS',
      reason: `backup path already holds a file: ${backupPath}`,
      canonicalPreserved: true,
    };
  }

  // Durability of the new bytes must precede visibility of the new bytes.
  try {
    fsyncPath(resolvedReplacement);
  } catch (error) {
    return {
      status: 'rejected',
      code: 'ARQ_SWAP_FAILED',
      reason: `could not flush replacement: ${error instanceof Error ? error.message : String(error)}`,
      canonicalPreserved: true,
    };
  }

  // Copy rather than rename: the canonical path must never be momentarily absent,
  // so a crash between here and the rename still leaves the original in place.
  if (canonicalExists) {
    try {
      copyFileSync(resolvedCanonical, backupPath);
      fsyncPath(backupPath);
      fsyncDirectory(backupPath);
    } catch (error) {
      return {
        status: 'rejected',
        code: 'ARQ_SWAP_BACKUP_FAILED',
        reason: `could not back up the canonical file: ${error instanceof Error ? error.message : String(error)}`,
        canonicalPreserved: true,
      };
    }
  }

  try {
    options.onStage?.('after-backup');
  } catch (error) {
    // A crash here is harmless: the canonical file has not been touched yet.
    rmSync(backupPath, { force: true });
    return {
      status: 'rejected',
      code: 'ARQ_SWAP_FAILED',
      reason: error instanceof Error ? error.message : String(error),
      canonicalPreserved: true,
    };
  }

  /**
   * Stale `-wal`/`-shm` sidecars belong to the file being replaced, not to the
   * replacement. Leaving them next to a brand-new canonical file lets SQLite
   * replay another database's write-ahead log into it, which is silent corruption
   * rather than a visible failure. They are moved aside before the swap, and only
   * discarded once the swap has succeeded.
   */
  const movedSidecars: { readonly from: string; readonly to: string }[] = [];
  try {
    for (const suffix of sidecarSuffixes) {
      const sidecar = `${resolvedCanonical}${suffix}`;
      if (existsSync(sidecar)) {
        const parked = `${backupPath}${suffix}`;
        renameSync(sidecar, parked);
        movedSidecars.push({ from: sidecar, to: parked });
      }
    }
  } catch (error) {
    for (const moved of movedSidecars) {
      try {
        renameSync(moved.to, moved.from);
      } catch {
        // Reported through the rejection below; the canonical file is still intact.
      }
    }
    rmSync(backupPath, { force: true });
    return {
      status: 'rejected',
      code: 'ARQ_SWAP_FAILED',
      reason: `could not park stale sidecars: ${error instanceof Error ? error.message : String(error)}`,
      canonicalPreserved: true,
    };
  }

  // rename(2) is atomic within a filesystem: readers see either the old file or the
  // new one, never a partially written mixture.
  try {
    renameSync(resolvedReplacement, resolvedCanonical);
  } catch (error) {
    for (const moved of movedSidecars) {
      try {
        renameSync(moved.to, moved.from);
      } catch {
        // The canonical file itself was never replaced.
      }
    }
    rmSync(backupPath, { force: true });
    return {
      status: 'rejected',
      code: 'ARQ_SWAP_FAILED',
      reason: `could not replace the canonical file: ${error instanceof Error ? error.message : String(error)}`,
      canonicalPreserved: true,
    };
  }

  fsyncDirectory(resolvedCanonical);

  try {
    options.onStage?.('after-rename');
  } catch (error) {
    // The canonical path now holds the replacement. Roll back to the last committed
    // revision from the backup rather than leaving a half-finished promotion.
    if (canonicalExists) {
      try {
        copyFileSync(backupPath, resolvedCanonical);
        fsyncPath(resolvedCanonical);
        fsyncDirectory(resolvedCanonical);
        for (const moved of movedSidecars) {
          renameSync(moved.to, moved.from);
        }
        rmSync(backupPath, { force: true });
        return {
          status: 'rejected',
          code: 'ARQ_SWAP_FAILED',
          reason: error instanceof Error ? error.message : String(error),
          canonicalPreserved: true,
        };
      } catch (rollbackError) {
        return {
          status: 'rejected',
          code: 'ARQ_SWAP_ROLLBACK_FAILED',
          reason: `swap failed and rollback failed: ${rollbackError instanceof Error ? rollbackError.message : String(rollbackError)}`,
          canonicalPreserved: false,
          recoverableFrom: backupPath,
        };
      }
    }
    rmSync(resolvedCanonical, { force: true });
    return {
      status: 'rejected',
      code: 'ARQ_SWAP_FAILED',
      reason: error instanceof Error ? error.message : String(error),
      canonicalPreserved: true,
    };
  }

  // The swap succeeded, so the parked sidecars describe a superseded revision.
  for (const moved of movedSidecars) {
    rmSync(moved.to, { force: true });
  }

  if (!canonicalExists) {
    return { status: 'swapped', backupPath: null };
  }
  if (options.retainBackup === true) {
    return { status: 'swapped', backupPath };
  }
  rmSync(backupPath, { force: true });
  return { status: 'swapped', backupPath: null };
}
