/**
 * The publication pipeline: an open project's working copy, checkpointed,
 * exported, reopened by a fresh reader nobody has told what to expect, and
 * compared against the source it came from. Only a match is a publication -
 * the pack's own rule, and the reason this does not stop at "bytes were
 * written."
 *
 * Every stage before the match is checked runs against the session's own
 * private state (`NativeProjectSession.prepareForPublication`) or against an
 * isolated verification session this function owns outright. Nothing here
 * touches the caller's active project: the source session stays open and
 * editable throughout, whether publication succeeds or fails.
 */
import { openNativeProject, type NativeWorkerFactory } from './open-native-project';
import type { NativeProjectSession } from './native-project-session';

export interface PublicationReceipt {
  readonly projectId: string;
  /** The working copy the fresh reader opened the published bytes into - a scratch copy, not the source's own. */
  readonly workingCopyId: string;
  readonly revision: number;
  readonly semanticHash: string;
  readonly byteLength: number;
  readonly publishedAtIso: string;
}

export type PublicationResult =
  | { readonly status: 'published'; readonly receipt: PublicationReceipt }
  | { readonly status: 'rejected'; readonly code: string; readonly reason: string };

function rejected(code: string, reason: string): PublicationResult {
  return { status: 'rejected', code, reason };
}

/**
 * Publishes the given session's current working revision as a portable,
 * standalone `.arq` file.
 *
 * `createFreshWorker` constructs the Worker the published bytes are verified
 * through - deliberately the caller's job, not something this function derives
 * from the source session, because a fresh reader that shared any state with
 * the writer would not be proving anything a writer's own optimism could not
 * already claim.
 */
export async function publishNativeProject(
  session: NativeProjectSession,
  createFreshWorker: NativeWorkerFactory,
): Promise<PublicationResult> {
  const prepared = await session.prepareForPublication();
  if (prepared.status === 'rejected') {
    return rejected(prepared.code, prepared.reason);
  }

  // A fresh reader: a Worker that has never touched the source working copy,
  // opening only the bytes that were just exported. This is the step that
  // turns "bytes were written" into "a publication" - a reader with no
  // knowledge of the writer's intentions either agrees with it or does not.
  const reopened = await openNativeProject(prepared.bytes, createFreshWorker, prepared.displayName);
  if (reopened.status === 'rejected') {
    return rejected(
      'ARQ_PUBLISH_VERIFICATION_FAILED',
      `The published file did not reopen cleanly: ${reopened.code}: ${reopened.reason}`,
    );
  }

  try {
    const reopenedHash = await reopened.session.computeSemanticHash();

    // Every mismatch is collected rather than reported one at a time: a
    // publication that disagrees with its source in more than one way should
    // say so in one refusal, not send the caller through several rounds to
    // discover the second problem after fixing the first.
    const mismatches: string[] = [];
    if (reopened.snapshot.projectId !== prepared.projectId) {
      mismatches.push(
        `project id "${reopened.snapshot.projectId}" does not match the source's "${prepared.projectId}"`,
      );
    }
    if (reopened.snapshot.journalSequence !== prepared.revision) {
      mismatches.push(
        `revision ${reopened.snapshot.journalSequence} does not match the source's ${prepared.revision}`,
      );
    }
    if (reopenedHash !== prepared.sourceSemanticHash) {
      mismatches.push('the reopened file has different content from what was exported');
    }
    if (mismatches.length > 0) {
      return rejected('ARQ_PUBLISH_VERIFICATION_MISMATCH', mismatches.join('; '));
    }

    return {
      status: 'published',
      receipt: {
        projectId: prepared.projectId,
        workingCopyId: reopened.snapshot.workingCopyId,
        revision: prepared.revision,
        semanticHash: prepared.sourceSemanticHash,
        byteLength: prepared.bytes.byteLength,
        publishedAtIso: new Date().toISOString(),
      },
    };
  } finally {
    // The reopened session is verification scaffolding, not a project the
    // caller asked to open - closed here regardless of outcome so its Worker,
    // and the scratch working copy it holds, do not outlive this call.
    await reopened.session.close().catch(() => undefined);
  }
}
