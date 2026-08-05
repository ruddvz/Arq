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
/**
 * Said the same way wherever it is said. A write-ahead-log project is compatible
 * and possibly incomplete - two facts about one accepted file, which the governed
 * file-flow policy requires be kept distinct - and opening it successfully does
 * not make the second fact go away, so both the compatibility state and the
 * opened state carry this.
 */
const WRITE_AHEAD_LOG_DETAIL =
  'This project was last written with a write-ahead log, so anything saved since its last checkpoint lives in a companion file ending in "-wal" that was not included. Choose the "-wal" file alongside it, or reopen and close the project in the app that wrote it, to be sure you have the newest version.';

export function describeFileFlowState(state: FileFlowState): FileFlowStateDescription {
  switch (state.kind) {
    case 'idle':
      return { headline: 'Choose a file to open.', detail: null, tone: 'neutral' };
    case 'acquiring':
      return { headline: `Reading ${state.name}…`, detail: null, tone: 'progress' };
    case 'detecting':
      return { headline: `Checking ${state.name}…`, detail: null, tone: 'progress' };
    case 'native-opening': {
      // The compatibility verdict, which is now a step on the way to an open
      // rather than the end of the road. It is still its own state, and still
      // says only what it knows: the bytes are a readable Arq project. Whether
      // this project opens is decided by the checks that follow.
      const next = 'Opening it now.';
      if (state.sidecarDependency === 'write-ahead-log-sidecar') {
        // Compatible but possibly incomplete: two different facts about one
        // accepted file, which the file-flow language policy requires be kept
        // distinct. This is a caution rather than a rejection because the file
        // is genuinely readable - what cannot be promised is that it is the
        // newest version of the user's work.
        return {
          headline: `${state.name} is a compatible Arq project, but it may not be complete.`,
          detail: `${WRITE_AHEAD_LOG_DETAIL} ${next}`,
          tone: 'warning',
        };
      }
      return {
        headline: `${state.name} is a compatible Arq project.`,
        detail: next,
        tone: 'neutral',
      };
    }
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
        detail:
          state.readOnlyReason === null
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
    case 'workspace-active': {
      // The only state that may say a project is open, so it is also the only
      // one that has to say what can be done with it - a reader told a project
      // is open will reasonably try to edit it. The read-only cause is named
      // rather than generalised: "this build cannot save" and "this file is
      // from a newer ARQ" are different facts about the reader's own work, and
      // giving the wrong one is a false statement, not a vague one.
      const { facts } = state;
      const incomplete = facts.sidecarDependency === 'write-ahead-log-sidecar';
      const parts: string[] = [];
      if (state.readOnlyReason !== null) {
        parts.push(describeReadOnlyReason(state.readOnlyReason));
      }
      if (incomplete) {
        parts.push(WRITE_AHEAD_LOG_DETAIL);
      }
      if (facts.conditionNote !== null) {
        parts.push(facts.conditionNote);
      }
      return {
        headline:
          state.readOnlyReason === null
            ? `${facts.projectName} is open · revision ${facts.revision}`
            : `${facts.projectName} is open, read-only · revision ${facts.revision}`,
        detail: parts.length > 0 ? parts.join(' ') : null,
        tone: incomplete ? 'warning' : 'neutral',
      };
    }
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

/**
 * One sentence per cause. Both are true statements a reader can act on: the
 * first says the limit is this build, the second says the limit is the file.
 */
function describeReadOnlyReason(
  reason: Exclude<Extract<FileFlowState, { kind: 'workspace-active' }>['readOnlyReason'], null>,
): string {
  switch (reason) {
    case 'build-cannot-write':
      return 'It is open for inspection: this build does not edit or save a .arq project, and the file you chose is unchanged.';
    case 'newer-format-version':
      return 'This project was written by a newer version of ARQ, so it can be read but not changed.';
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
