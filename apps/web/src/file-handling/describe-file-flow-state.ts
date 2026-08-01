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
    case 'native-opening': {
      // Honest boundary: the byte-safe preflight gate passed, but this build
      // does not yet load the file into a live project (the browser
      // Worker/OPFS driver is not wired into this app) - never claim the
      // project is open when it is not.
      const unwired = 'Full in-browser opening is not wired into this build yet.';
      if (state.sidecarDependency === 'write-ahead-log-sidecar') {
        // Compatible but possibly incomplete: two different facts about one
        // accepted file, which the file-flow language policy requires be kept
        // distinct. This is a caution rather than a rejection because the file
        // is genuinely readable - what cannot be promised is that it is the
        // newest version of the user's work.
        return {
          headline: `${state.name} is a compatible Arq project, but it may not be complete.`,
          detail: `This project was last written with a write-ahead log, so anything saved since its last checkpoint lives in a companion file ending in "-wal" that was not included. Choose the "-wal" file alongside it, or reopen and close the project in the app that wrote it, to be sure you have the newest version. ${unwired}`,
          tone: 'warning',
        };
      }
      return {
        headline: `${state.name} is a compatible Arq project.`,
        detail: unwired,
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
  }
}
