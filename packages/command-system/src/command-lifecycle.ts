/**
 * ARQ-038: command lifecycle state machine.
 *
 * Implements the 8-state tool lifecycle from docs/ux/COMMAND-LIFECYCLE.md
 * (Idle, Armed, Previewing, Awaiting input, Validating, Committed, Failed
 * safely, Cancelled), plus that spec's Escape/Enter contract:
 *
 * - "Escape clears field, cancels segment, then exits tool" - a graduated,
 *   three-tier cancel: clear a pending field edit first; if there is none,
 *   pop (cancel) the most recently placed segment; if there are no
 *   segments left, exit the tool (-> Cancelled).
 * - "Enter commits only a valid preview" - commit() only transitions out of
 *   Previewing/Awaiting input, and only reaches Committed when the caller
 *   reports the preview as valid; an invalid commit goes to Failed safely
 *   instead, so a caller must never apply project-state changes except on
 *   a Committed result - "invalid operations leave project state
 *   unchanged" is a property of *how this is used*, not something this
 *   module can enforce by itself, since it does not touch project state.
 */

export type CommandState =
  | 'idle'
  | 'armed'
  | 'previewing'
  | 'awaiting-input'
  | 'validating'
  | 'committed'
  | 'failed-safely'
  | 'cancelled';

export interface CommandLifecycleSnapshot {
  readonly state: CommandState;
  readonly segmentCount: number;
  readonly hasPendingField: boolean;
}

const TERMINAL_STATES: ReadonlySet<CommandState> = new Set([
  'idle',
  'committed',
  'failed-safely',
  'cancelled',
]);

export function createCommandLifecycle() {
  let state: CommandState = 'idle';
  let segmentCount = 0;
  let hasPendingField = false;

  function snapshot(): CommandLifecycleSnapshot {
    return { state, segmentCount, hasPendingField };
  }

  /** Select the tool: Idle -> Armed. No-op from any other state. */
  function arm(): CommandLifecycleSnapshot {
    if (state !== 'idle') {
      return snapshot();
    }
    state = 'armed';
    segmentCount = 0;
    hasPendingField = false;
    return snapshot();
  }

  /** Pointer movement produces a live preview: Armed/Awaiting input -> Previewing. */
  function beginPreview(): CommandLifecycleSnapshot {
    if (state !== 'armed' && state !== 'awaiting-input') {
      return snapshot();
    }
    state = 'previewing';
    return snapshot();
  }

  /** The user starts typing a precise value into a numeric input field. */
  function editField(): CommandLifecycleSnapshot {
    if (state !== 'previewing') {
      return snapshot();
    }
    hasPendingField = true;
    return snapshot();
  }

  /** A click (or field entry) locks in the current preview as a segment. */
  function placeSegment(): CommandLifecycleSnapshot {
    if (state !== 'previewing') {
      return snapshot();
    }
    segmentCount += 1;
    hasPendingField = false;
    state = 'awaiting-input';
    return snapshot();
  }

  /**
   * Attempt to finish the command (Enter, or a tool-specific finish
   * action). Only valid from Previewing/Awaiting input; `isValid` is
   * supplied by the caller (the tool knows its own validation rules) and
   * decides whether Validating resolves to Committed or Failed safely.
   */
  function commit(isValid: boolean): CommandLifecycleSnapshot {
    if (state !== 'previewing' && state !== 'awaiting-input') {
      return snapshot();
    }
    state = 'validating';
    state = isValid ? 'committed' : 'failed-safely';
    return snapshot();
  }

  function escape(): CommandLifecycleSnapshot {
    if (TERMINAL_STATES.has(state)) {
      return snapshot();
    }
    if (hasPendingField) {
      hasPendingField = false;
      return snapshot();
    }
    if (segmentCount > 0) {
      segmentCount -= 1;
      state = segmentCount > 0 ? 'awaiting-input' : 'armed';
      return snapshot();
    }
    state = 'cancelled';
    return snapshot();
  }

  /** Return to Idle from any terminal state (Committed/Failed safely/Cancelled), ready to arm again. */
  function reset(): CommandLifecycleSnapshot {
    state = 'idle';
    segmentCount = 0;
    hasPendingField = false;
    return snapshot();
  }

  return { snapshot, arm, beginPreview, editField, placeSegment, commit, escape, reset };
}
