import type { ModelOperation } from './operation';
import {
  commitOperation,
  type CommitOperationInput,
  type CommitOperationOutcome,
  type OperationRejectionCode,
} from './operation-pipeline';
import type { GroupedUndoStack } from './grouped-undo-stack';

/**
 * V3-102 / AC3-034: one wall gesture is one undo group.
 *
 * Drawing a wall is a single thing a user did, and it is several operations.
 * The wall is created; where it crosses a room the room splits; both joins with
 * neighbouring walls resolve; any opening that was hosted on a wall the new one
 * replaced re-hosts. `createGroupedUndoStack` (V3-054) already knows how to
 * hold those together; what did not exist was anything that *uses* it for a
 * real workflow, and a grouping mechanism nothing groups with is not evidence
 * of anything.
 *
 * The failure condition AC3-034 names is "one gesture creates fragmented or
 * unrelated undo". Both halves matter and they fail in opposite directions.
 * Fragmented: the user presses undo, the room un-splits but the wall stays,
 * and the project is now in a state that never existed for them. Unrelated:
 * the group is left open across gestures, so undoing the wall also reverses
 * the door someone placed afterwards. So a group is opened exactly once per
 * gesture and always closed - on success, on failure, and on cancellation.
 *
 * A partial gesture is never history. If any step in the chain is rejected the
 * whole group is abandoned rather than pushed, and the entries recorded so far
 * are handed back for the caller to reverse. A half-drawn wall the user never
 * saw complete has no place in the undo affordance's list: "Undo draw wall"
 * that reverses two thirds of a wall is worse than no entry at all.
 */

/** One step of the gesture: the operation, plus how to run it. */
export interface WallWorkflowStep<TState> {
  /** The user's word for this step, only used in diagnostics - the *group* carries the visible label. */
  readonly description: string;
  readonly operation: ModelOperation;
  /**
   * The step's inverse, taken from the applied result rather than guessed. A
   * caller supplies it because only the operation itself knows what undoes it.
   */
  readonly inverseOf: (
    outcome: Extract<CommitOperationOutcome<TState>, { status: 'committed' }>,
  ) => ModelOperation | null;
}

export interface CommitWallWorkflowInput<TState> {
  /** The label the undo affordance shows, e.g. "Draw wall". */
  readonly label: string;
  readonly undoStack: GroupedUndoStack<ModelOperation>;
  readonly steps: readonly WallWorkflowStep<TState>[];
  readonly initialState: TState;
  readonly initialRevision: number;
  /** Everything `commitOperation` needs that does not vary between steps. */
  readonly pipeline: Omit<CommitOperationInput<TState>, 'state' | 'operation' | 'currentRevision'>;
}

export type CommitWallWorkflowOutcome<TState> =
  | {
      readonly status: 'committed';
      readonly state: TState;
      readonly revision: number;
      readonly stepCount: number;
    }
  | {
      readonly status: 'rejected';
      readonly code: OperationRejectionCode;
      readonly detail: string;
      /** The step that failed, by index into `steps`. */
      readonly failedStep: number;
      /**
       * The state reached before the failure. Not committed history: the caller
       * reverses `reversals` against it to get back to where the gesture began.
       */
      readonly state: TState;
      readonly revision: number;
      /** Inverses to apply, newest first, to undo the partial gesture. */
      readonly reversals: readonly ModelOperation[];
    };

/**
 * Runs a wall gesture's operations as one undo group.
 *
 * Steps run in order and each sees the state the previous one produced, because
 * the later steps of this gesture depend on the earlier ones - a join cannot
 * resolve against a wall that has not been created yet. That sequencing is also
 * why the first rejection stops the chain: continuing past it would apply
 * operations whose preconditions were written against a state that no longer
 * arrives.
 *
 * `commitOperation` guarantees each individual rejection leaves state and
 * revision untouched. This adds the group-level guarantee on top: a rejected
 * gesture leaves no undo entry at all.
 *
 * Every step after the first is rebased onto the revision the previous step
 * produced. `commitOperation` otherwise rejects it as stale, correctly - its
 * staleness check exists because an operation built on a revision the store has
 * moved past was validated against state that no longer exists. Inside one
 * gesture that reasoning does not apply: the only revisions in between are the
 * ones this function just made, from the steps of this same gesture, and it
 * knows exactly what they were. That is the whole of the exception, and it is
 * why the *first* step is never rebased - if the gesture as a whole was built
 * against state the store has moved past, it is genuinely stale and is
 * rejected, which is the check doing its job.
 */
export function commitWallWorkflow<TState>(
  input: CommitWallWorkflowInput<TState>,
): CommitWallWorkflowOutcome<TState> {
  const { undoStack, steps, label } = input;

  undoStack.beginGroup(label);

  let state = input.initialState;
  let revision = input.initialRevision;

  for (let index = 0; index < steps.length; index += 1) {
    const step = steps[index];
    if (step === undefined) {
      continue;
    }

    // See the rebase note above: only steps after the first, only onto
    // revisions this gesture itself produced.
    const operation = index === 0 ? step.operation : { ...step.operation, baseRevision: revision };

    const outcome = commitOperation<TState>({
      ...input.pipeline,
      state,
      operation,
      currentRevision: revision,
    });

    if (outcome.status === 'rejected') {
      const reversals = undoStack
        .abandonGroup()
        .map((entry) => entry.inverse)
        .reverse();
      return {
        status: 'rejected',
        code: outcome.code,
        detail: `${step.description}: ${outcome.detail}`,
        failedStep: index,
        state: outcome.state,
        revision: outcome.revision,
        reversals,
      };
    }

    state = outcome.state;
    revision = outcome.revision;

    const inverse = step.inverseOf(outcome);
    if (inverse !== null) {
      undoStack.record({ forward: operation, inverse });
    }
    // A step with no inverse - a pure recomputation that the next undo will
    // redo from scratch anyway - is committed but not recorded. It is still
    // inside the group, so it cannot fragment the history; it simply has
    // nothing to contribute to it.
  }

  undoStack.endGroup();

  return { status: 'committed', state, revision, stepCount: steps.length };
}

/**
 * Abandons a gesture the user cancelled mid-draw.
 *
 * Separate from the rejection path above because the two are not the same
 * event, even though they clean up identically: a rejection is Arq refusing,
 * and a cancellation is the user changing their mind. Conflating them means a
 * cancelled gesture reports an error code somewhere, which is how a UI ends up
 * telling a user something went wrong when they pressed Escape.
 */
export function abandonWallWorkflow(
  undoStack: GroupedUndoStack<ModelOperation>,
): readonly ModelOperation[] {
  return undoStack
    .abandonGroup()
    .map((entry) => entry.inverse)
    .reverse();
}
