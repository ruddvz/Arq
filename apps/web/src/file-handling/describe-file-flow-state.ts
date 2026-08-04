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
    case 'opening-project':
      // Names the stage rather than showing a percentage: the staged open has no
      // measurable fraction, and an invented one is a worse answer than the real
      // step name.
      return {
        headline: `Opening ${state.name}…`,
        detail: `Step: ${state.stageName}.`,
        tone: 'progress',
      };
    case 'project-open-read-only': {
      // The first state in this build that may say a project is open. It says so
      // plainly, and in the same breath says what cannot be done with it - because
      // a user who is told a project is open will reasonably try to edit it.
      const readOnly =
        'It is open for inspection: this build does not edit or save a .arq project, and the file you chose is unchanged.';
      const parts = [readOnly];
      if (state.sidecarDependency === 'write-ahead-log-sidecar') {
        parts.push(WRITE_AHEAD_LOG_DETAIL);
      }
      if (state.conditionNote !== null) {
        parts.push(state.conditionNote);
      }
      return {
        headline: `${state.projectName} is open, read-only · revision ${state.revision}`,
        detail: parts.join(' '),
        tone: state.sidecarDependency === 'write-ahead-log-sidecar' ? 'warning' : 'neutral',
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
