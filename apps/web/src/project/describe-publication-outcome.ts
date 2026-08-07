import type { ArqfsPublicationReceipt, ArqfsPublicationRefusal } from '@arq/arqfs';
import type { NativePublishResult } from './native-project-session';

/**
 * One place that turns a publication verdict into copy, for the same reason
 * `describe-file-flow-state.ts` exists on the open side: every surface that
 * reports a saved copy has to say the same true thing about the same outcome,
 * and a paraphrase written at a call site is where an untrue one gets in.
 *
 * The specific untruth this guards against is the one that costs a user their
 * work. `publishProjectFile` (packages/arqfs/src/arqfs-publication.ts) refuses
 * on eleven distinct failures, and every one of them leaves the same two facts
 * standing: no verified file was handed over, and the project on this device
 * still holds every change. A message that names the failure without saying the
 * second part reads as "your project is damaged", and a user who believes that
 * does destructive things to recover from a state they were never in.
 *
 * So the reassurance is not written per branch, where it could be forgotten. It
 * is appended to every refusal by `describePublicationOutcome` itself, and
 * `describe-publication-outcome.test.ts` asserts it over the full union rather
 * than over a list of examples.
 */

export type PublicationOutcomeTone = 'success' | 'error';

export interface PublicationOutcomeDescription {
  readonly headline: string;
  /**
   * The real diagnostic, not a paraphrase - same rule as the file-flow copy.
   * Always present on a refusal: a failure a user cannot name is one they
   * cannot report or work around.
   */
  readonly detail: string;
  readonly tone: PublicationOutcomeTone;
}

/**
 * Said once, appended to every refusal. Present tense and unconditional,
 * because it is unconditional: publication's only write to the working project
 * is a WAL checkpoint, which moves committed pages without changing what the
 * project means.
 */
const WORK_IS_SAFE = 'Your project on this device still holds every change.';

/**
 * Why each refusal happened, in the user's terms, and what they can do next.
 * Deliberately exhaustive rather than defaulted: a new refusal reason added to
 * `ArqfsPublicationRefusal` fails to compile here instead of reaching a user as
 * a generic "something went wrong".
 */
function describeRefusal(reason: ArqfsPublicationRefusal, detail: string): string {
  switch (reason) {
    case 'working-copy-missing':
      return `This project has no saved revision to copy yet. Make a change, then save a copy. (${detail})`;
    case 'working-copy-not-settled':
      // Not an error the user caused, and not one they fix by retrying harder -
      // a write is in flight or did not finish, and the honest instruction is
      // to let it settle.
      return `A change is still being written, so a copy taken now would not match what you see. Wait for the project to finish saving, then try again. (${detail})`;
    case 'revision-not-current':
      return `The project moved on from the revision this copy was asked for. Try again to copy where the project is now. (${detail})`;
    case 'export-failed':
      return `The copy could not be written. (${detail})`;
    case 'reader-open-failed':
      return `The copy was written but could not be reopened to check it, so it was not handed over. (${detail})`;
    case 'reader-rejected':
      return `The copy was written but did not read back as a project this build can open, so it was not handed over. (${detail})`;
    case 'integrity-failed':
      return `The copy was written but failed its own consistency checks, so it was not handed over. (${detail})`;
    case 'entry-digest-failed':
      return `Part of the copy did not match its recorded content, so it was not handed over. (${detail})`;
    case 'identity-mismatch':
      return `The copy read back as a different project, so it was not handed over. (${detail})`;
    case 'revision-drift':
      return `The copy read back at a different revision, so it was not handed over. (${detail})`;
    case 'semantic-mismatch':
      // The strongest check and the one worth naming plainly: the bytes exist
      // and open, and still do not mean the same thing.
      return `The copy opened, but its contents did not match this project, so it was not handed over. (${detail})`;
    case 'sidecar-present':
      return `The copy depends on a companion file, so it would lose work if it were moved on its own. It was not handed over. (${detail})`;
  }
}

/**
 * Wording for a copy that passed every check. Says what was checked rather than
 * asserting the file is correct: the claim this build can make is that an
 * independent reader opened the saved bytes and found this project at this
 * revision, and that is what the sentence says.
 */
function describeReceipt(receipt: ArqfsPublicationReceipt, fileName: string): string {
  return `Reopened and checked ${fileName}: revision ${receipt.revision}, ${receipt.entryCount} ${receipt.entryCount === 1 ? 'entry' : 'entries'}, ${receipt.byteLength} bytes.`;
}

export function describePublicationOutcome(
  result: NativePublishResult,
  fileName: string,
): PublicationOutcomeDescription {
  if (result.status === 'published') {
    return {
      headline: `Saved a copy as ${fileName}.`,
      detail: describeReceipt(result.receipt, fileName),
      tone: 'success',
    };
  }
  return {
    headline: 'No copy was saved.',
    detail: `${describeRefusal(result.reason, result.detail)} ${WORK_IS_SAFE}`,
    tone: 'error',
  };
}

/**
 * The one failure that is not a publication refusal: verification passed, and
 * handing the bytes to the browser is what failed. Kept distinct because the
 * file it describes is different - a verified copy exists in memory and did not
 * reach the user - and folding it into `export-failed` would report a
 * verification failure that did not happen.
 */
export function describeDeliveryFailure(detail: string): PublicationOutcomeDescription {
  return {
    headline: 'No copy was saved.',
    detail: `The copy was checked but this browser did not accept the download. (${detail}) ${WORK_IS_SAFE}`,
    tone: 'error',
  };
}

export const PUBLICATION_WORK_IS_SAFE_SENTENCE = WORK_IS_SAFE;
