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
      // Honest boundary: the file passed byte preflight and the
      // source-completeness policy, but this build does not yet load it into a
      // live project (no browser Worker/OPFS driver is constructed here) -
      // never claim the project is open when it is not.
      //
      // There is no longer a "compatible, but may not be complete" branch. A
      // database depending on an absent `-wal` sidecar is refused before it
      // reaches this state, because the caution it used to show sat next to a
      // project that could be silently missing the user's most recent work.
      return {
        headline: `${state.name} is a compatible, complete Arq project.`,
        detail: 'Full in-browser opening is not wired into this build yet.',
        tone: 'neutral',
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
  }
}
