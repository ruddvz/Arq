import type { FileFlowState } from './file-state-machine';

export interface FileFlowStateDescription {
  readonly headline: string;
  /** Secondary detail - the real diagnostic code/reason, not paraphrased. Rendered behind a disclosure, never hidden entirely (master prompt: "no raw SQLite error or empty editor shell leaks to users", not "no diagnostic at all"). */
  readonly detail: string | null;
  readonly tone: 'neutral' | 'progress' | 'error' | 'warning';
}

/**
 * UI-011/UI-013: one place that turns `FileFlowState` into copy, so every
 * surface that shows file-open status (this component now, a future recovery
 * or diagnostics view later) says the same true thing about the same state
 * rather than each caller writing its own paraphrase. Every branch is
 * explicit rather than a default case, so a new `FileFlowState` variant fails
 * to compile here instead of silently falling through to a generic message.
 */
export function describeFileFlowState(state: FileFlowState): FileFlowStateDescription {
  switch (state.kind) {
    case 'idle':
      return { headline: 'Choose a file to open.', detail: null, tone: 'neutral' };
    case 'acquiring':
      return { headline: `Reading ${state.name}…`, detail: null, tone: 'progress' };
    case 'detecting':
      return { headline: `Checking ${state.name}…`, detail: null, tone: 'progress' };
    case 'native-opening':
      // Progress, not a verdict. The file passed byte preflight and the
      // source-completeness policy and is now being copied into a local working
      // copy and opened - which is work, not a formality, so it gets its own
      // state rather than being folded into success.
      //
      // There is no longer a "compatible, but may not be complete" branch. A
      // database depending on an absent `-wal` sidecar is refused before it
      // reaches this state, because the caution it used to show sat next to a
      // project that could be silently missing the user's most recent work.
      return {
        headline: `Opening ${state.name}…`,
        detail: 'Copying this project into a local working copy on this device.',
        tone: 'progress',
      };
    case 'import-options':
      return {
        headline: `${state.name} needs conversion before it can be opened.`,
        detail: `Detected format: ${state.formatId}. Import review is not wired into this build yet.`,
        tone: 'warning',
      };
    case 'importing':
      return {
        headline: `Converting ${state.name}… ${Math.round(state.fraction * 100)}%`,
        detail: null,
        tone: 'progress',
      };
    case 'staged-review':
      return {
        headline: `${state.name} is staged for review.`,
        detail: null,
        tone: 'neutral',
      };
    case 'migrating':
      return {
        headline: `Migrating ${state.name}… ${Math.round(state.fraction * 100)}%`,
        detail: null,
        tone: 'progress',
      };
    case 'read-only-safe-mode':
      return {
        headline: `${state.name} opened read-only.`,
        detail: state.reason,
        tone: 'warning',
      };
    case 'failed':
      return {
        headline: state.name
          ? `${state.name} could not be opened.`
          : 'This file could not be opened.',
        detail: `${state.code}: ${state.message}`,
        tone: 'error',
      };

    // The lifecycle after preflight. None of these says "open" except
    // workspace-active: the project is not open while it is being copied,
    // verified, handed to the Worker, or hydrated, and saying otherwise is the
    // false-open failure this flow exists to prevent.
    case 'staging':
      return {
        headline: `Copying ${state.name} to work on… ${Math.round(state.fraction * 100)}%`,
        detail: 'Your original file is not changed.',
        tone: 'progress',
      };
    case 'staged':
      return {
        headline: `${state.name} is copied and ready to check.`,
        detail: 'Your original file is not changed.',
        tone: 'progress',
      };
    case 'migration-verified':
      return {
        headline: `${state.name} was upgraded and checked.`,
        detail: 'The upgrade ran on the copy. Your original file is not changed.',
        tone: 'progress',
      };
    case 'worker-open':
      return {
        headline: `${state.name} is loading…`,
        detail: state.writable
          ? 'The project file is open. Reading its contents now.'
          : 'The project file is open for reading only. Reading its contents now.',
        tone: 'progress',
      };
    case 'hydrating':
      return {
        headline: `Reading the contents of ${state.name}…`,
        detail: null,
        tone: 'progress',
      };
    case 'workspace-active':
      return {
        headline: state.writable
          ? `${state.name} is open.`
          : `${state.name} is open and read-only.`,
        detail: state.writable
          ? null
          : 'This project was written by a newer version of ARQ, so it can be read but not changed.',
        tone: state.writable ? 'neutral' : 'warning',
      };
    case 'quarantined':
      return {
        headline: `${state.name} could not be upgraded.`,
        detail:
          `The half-upgraded copy has been kept at ${state.quarantinePath} so the problem can be ` +
          'investigated. Your original file is not changed, and any project you already had open is untouched.',
        tone: 'error',
      };
    case 'cancelled':
      return {
        headline: `Opening ${state.name} was cancelled.`,
        detail: `Cancelled while ${describeStage(state.cancelledAt)}. Nothing was changed.`,
        tone: 'neutral',
      };
    case 'project-failed':
      return {
        headline: `${state.name} could not be opened.`,
        detail: `${describeFailureReason(state.reason)} ${state.detail}`.trim(),
        tone: 'error',
      };
    case 'recovery-available':
      return {
        headline: `${state.name} has ${state.journalledOperations} unsaved change${
          state.journalledOperations === 1 ? '' : 's'
        } from last time.`,
        detail:
          'Recovery available. These changes are on this device and are not in the project file yet.',
        tone: 'warning',
      };
    case 'recovering':
      return {
        headline: `Restoring your changes to ${state.name}…`,
        detail: null,
        tone: 'progress',
      };
    case 'publishing':
      return {
        headline: `Publishing ${state.name}… ${Math.round(state.fraction * 100)}%`,
        detail: 'Writing a single project file you can move or share.',
        tone: 'progress',
      };
    case 'published':
      return {
        headline: `${state.name} was published.`,
        detail: 'The published file was reopened and checked before it was handed over.',
        tone: 'neutral',
      };
    case 'closed':
      return {
        headline: 'No project is open.',
        detail: state.lastKnownGood ? `${state.lastKnownGood.name} was closed.` : null,
        tone: 'neutral',
      };
  }
}

function describeStage(
  stage: Extract<FileFlowState, { kind: 'cancelled' }>['cancelledAt'],
): string {
  switch (stage) {
    case 'staging':
      return 'copying the file';
    case 'migrating':
      return 'upgrading the copy';
    case 'worker-open':
      return 'opening the project file';
    case 'hydrating':
      return 'reading the contents';
    case 'publishing':
      return 'publishing';
  }
}

/**
 * One sentence per cause, in the user's terms. The raw reason still travels
 * with the state for diagnostics; this is the part a person can act on.
 */
function describeFailureReason(
  reason: Extract<FileFlowState, { kind: 'project-failed' }>['reason'],
): string {
  switch (reason) {
    case 'unsupported-version':
      return 'It was written by a newer version of ARQ than this one can read.';
    case 'unsupported-capability':
      return 'It uses a feature this version of ARQ does not support.';
    case 'invalid-header':
      return 'It is not an ARQ project file.';
    case 'truncated':
      return 'The file ends earlier than it should, so part of it is missing.';
    case 'corrupt':
      return 'The file is damaged.';
    case 'migration-failed':
      return 'The upgrade to the current format did not finish.';
    case 'integrity-failed':
      return 'The contents did not pass their own consistency checks.';
    case 'worker-failed':
      return 'The background process that opens projects stopped unexpectedly.';
    case 'hydration-failed':
      return 'The file opened, but its contents could not be read.';
    case 'quota-exhausted':
      return 'There is not enough storage space on this device to work on it.';
    case 'permission-denied':
      return 'This browser did not allow ARQ to store the working copy.';
    case 'publication-failed':
      return 'The published file could not be written or did not pass its check afterwards.';
    case 'recovery-failed':
      return 'Your recovered changes could not be replayed onto this project.';
  }
}
