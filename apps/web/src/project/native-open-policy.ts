/**
 * What the product is allowed to do with a native project once ARQFS has said
 * what the *file* allows - two different questions, decided in two places on
 * purpose.
 *
 * `openArqfs` answers the format question: may this build read these bytes, may
 * it write them, could it migrate them. This module answers the product
 * question: given that verdict, does the user get an editable project, a
 * read-only one, or none at all. They differ in exactly one direction, and it is
 * always the safe one - the product may refuse what the format permits, never
 * the reverse.
 */
import type { ArqfsOpenResult } from '@arq/arqfs';
/*
 * Deep import, deliberately, and the same seam `native-project-session.ts` uses
 * for the publication types. `@arq/arqfs`'s barrel also exports the Node-only
 * atomic swap, so taking a *value* from it drags `node:fs` into the browser
 * bundle and the build fails - which is exactly what happened when this was a
 * barrel import. Types are erased and safe to take from the barrel; values are
 * not.
 */
import { conditionForcesReadOnly, type ArqfsSafeModePlan } from '@arq/arqfs/src/arqfs-safe-mode';

export interface NativeOpenCapabilities {
  readonly readOnly: boolean;
  /**
   * Why the project is not fully editable, in the user's terms. Empty for a
   * current writable project. These are shown, not logged: a project that
   * silently refuses edits is a bug report, and one that explains itself is a
   * product.
   */
  readonly warnings: readonly string[];
}

export const NATIVE_OPEN_WARNINGS = {
  olderSchema:
    'This project uses an older Arq format. It is open for reading only in this window because migration of its local working copy could not run safely here.',
  futureWriter:
    'This project was saved by a newer version of Arq. It is open for reading only, because writing it with this version could discard information this version does not understand.',
  safeMode:
    'Parts of this project use features this version of Arq does not understand. It is open for reading only.',
  interruptedWrite:
    'The last change to this project did not finish being written, so what is in the file is a change the project never completed. It is open for reading only, and the original is untouched, so you can save a copy of it before anything is changed.',
  corrupt:
    'This project file did not pass its own consistency checks, so it was not opened. The file has not been changed, so a backup or an earlier copy can still be opened instead.',
} as const;

/**
 * What the *condition* of a file says, as opposed to what its format version
 * permits. `resolveNativeOpenCapabilities` answers the second; this answers the
 * first, and the two are combined by the caller rather than merged here,
 * because a project can be limited by both at once and a user is owed both
 * reasons.
 *
 * Returns null when the condition places no limit - which includes every
 * condition the format side already covers. Only the two that mean this working
 * copy's own last write did not land are answered here; `conditionForcesReadOnly`
 * is the single definition of which those are, shared with the Worker that
 * enforces it, so the message a user reads and the connection that refuses the
 * write can never disagree.
 */
export function describeOpenCondition(plan: ArqfsSafeModePlan): string | null {
  if (!conditionForcesReadOnly(plan)) return null;
  return plan.kind === 'corrupt'
    ? NATIVE_OPEN_WARNINGS.corrupt
    : NATIVE_OPEN_WARNINGS.interruptedWrite;
}

/**
 * A rejected open has no product capabilities at all - the caller must not reach
 * this function with one, and gets a refusal rather than a silently read-only
 * project if it does.
 */
export function resolveNativeOpenCapabilities(result: ArqfsOpenResult): NativeOpenCapabilities {
  if (result.status === 'rejected') {
    return { readOnly: true, warnings: [`This project could not be opened: ${result.reason}.`] };
  }

  const { canRead, canWrite, canMigrate, safeModeRequired } = result.capabilities;
  const warnings: string[] = [];

  if (!canRead || safeModeRequired) {
    return { readOnly: true, warnings: [NATIVE_OPEN_WARNINGS.safeMode] };
  }
  if (!canWrite) {
    warnings.push(NATIVE_OPEN_WARNINGS.futureWriter);
  }
  // `canMigrate` now remains true only when the product deliberately did not
  // migrate this working copy, most commonly because another window owns the
  // writer lease. A successfully migrated candidate is reopened before it reaches
  // this policy and therefore arrives with `canMigrate: false`.
  else if (canMigrate) {
    warnings.push(NATIVE_OPEN_WARNINGS.olderSchema);
  }

  return { readOnly: warnings.length > 0, warnings };
}

/** Identity a remembered OPFS working copy claims, stored alongside the pointer to it. */
export interface RememberedProjectDescriptor {
  readonly workingCopyId: string;
  readonly projectId: string;
  readonly displayName: string;
}

export interface ResumedProjectIdentity {
  readonly workingCopyId: string;
  readonly projectId: string;
}

export class NativeProjectIdentityError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NativeProjectIdentityError';
  }
}

/**
 * Refuses to adopt a working copy whose manifest names a different project than
 * the pointer that led us to it.
 *
 * The pointer and the database are separate pieces of state that can drift: a
 * remembered descriptor survives in local storage across sessions, while the
 * OPFS file it names can be replaced, recreated under a reused id, or left over
 * from an interrupted open. Trusting the pointer would then reopen project B
 * under project A's name - and the first save would write A's edits into B.
 * Cheap to check, and the only moment it can be checked is before adoption.
 */
export function assertResumedProjectIdentity(
  descriptor: RememberedProjectDescriptor,
  resumed: ResumedProjectIdentity,
): void {
  if (descriptor.workingCopyId !== resumed.workingCopyId) {
    throw new NativeProjectIdentityError(
      'The remembered project identity does not match the local working copy that was opened.',
    );
  }
  if (descriptor.projectId !== resumed.projectId) {
    throw new NativeProjectIdentityError(
      'The remembered project identity does not match the project recorded inside the local working copy.',
    );
  }
}
