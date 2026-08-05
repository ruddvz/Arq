import type { GroupedUndoStack } from './grouped-undo-stack';
import type { ModelOperation } from './operation';
import type { CommitOperationInput, CommitOperationOutcome } from './operation-pipeline';
import { commitWallWorkflow, type WallWorkflowStep } from './wall-workflow-commit';
import {
  evaluateProposal,
  type AiProposal,
  type EvaluateProposalInput,
  type ProposalEvaluation,
  type ProposalRefusalCode,
} from './ai-proposal';

/**
 * V3-171 / AC3-035, AC3-090: applying an approved proposal.
 *
 * Two things have to be true at once and they pull in opposite directions.
 *
 * AC3-035 says AI mutations use the same operation engine as everything else -
 * no alternate path. So this does not apply operations; it hands them to
 * `commitOperation` through the same sequencing `commitWallWorkflow` already
 * owns, and every writability check, staleness check, precondition, candidate
 * validation and revision assertion applies unchanged. An AI-authored operation
 * that would be refused from the toolbar is refused here for the same reason,
 * reported with the same code.
 *
 * AC3-090 says proposal, approval and apply stay distinct - a proposal must
 * never be shown as applied. So `applyProposal` will not run anything
 * `evaluateProposal` has not cleared, and it returns a result that says what
 * committed rather than assuming the approval was the outcome. An approval is
 * a decision; an apply is an event; they are reported separately because they
 * can differ, and the case where they differ is the one that matters.
 *
 * Undo is one group, labelled with what the user asked for rather than with the
 * model's summary. "Undo add a partition and label the new room" is a sentence
 * the user recognises because they wrote it; "Undo proposal-4f2a" is not.
 */

export interface ApplyProposalInput<TState> {
  readonly proposal: AiProposal;
  readonly grant: EvaluateProposalInput['grant'];
  readonly currentRevision: number;
  readonly approvedOperationIds: EvaluateProposalInput['approvedOperationIds'];
  readonly undoStack: GroupedUndoStack<ModelOperation>;
  readonly initialState: TState;
  /** The same pipeline every other mutation path uses. No AI-specific variant. */
  readonly pipeline: Omit<CommitOperationInput<TState>, 'state' | 'operation' | 'currentRevision'>;
  /**
   * The inverse of a committed operation. Supplied by the caller because only
   * the operation knows what undoes it - the same reason
   * `WallWorkflowStep.inverseOf` takes one.
   */
  readonly inverseOf: (
    operation: ModelOperation,
    outcome: Extract<CommitOperationOutcome<TState>, { status: 'committed' }>,
  ) => ModelOperation | null;
}

export type ApplyProposalResult<TState> =
  | {
      readonly status: 'applied';
      readonly state: TState;
      readonly revision: number;
      readonly appliedOperationIds: readonly string[];
      /** The label the undo affordance now shows. */
      readonly undoLabel: string;
    }
  | {
      /** The approval was never cleared: nothing ran, and nothing needs reversing. */
      readonly status: 'refused';
      readonly code: ProposalRefusalCode;
      readonly detail: string;
      readonly state: TState;
      readonly revision: number;
    }
  | {
      /**
       * Cleared, then rejected part-way through by the operation engine. The
       * distinction from `refused` is real: something ran, and the caller has
       * inverses to apply.
       */
      readonly status: 'failed';
      readonly code: string;
      readonly detail: string;
      readonly failedOperationIndex: number;
      readonly state: TState;
      readonly revision: number;
      /** Inverses to apply, newest first, to undo the partial application. */
      readonly reversals: readonly ModelOperation[];
    };

/**
 * Evaluates an approval and, if it clears, applies it as one undo group.
 *
 * The evaluation is not optional and cannot be skipped by a caller in a hurry:
 * it happens here, before anything runs, so there is no arrangement of calls
 * that applies an unevaluated proposal.
 *
 * A mid-application failure abandons the group rather than pushing a partial
 * one, for the same reason a cancelled wall gesture does: "Undo add a partition"
 * that reverses a third of it is worse than no entry at all.
 */
export function applyProposal<TState>(
  input: ApplyProposalInput<TState>,
): ApplyProposalResult<TState> {
  const evaluation: ProposalEvaluation = evaluateProposal({
    proposal: input.proposal,
    grant: input.grant,
    currentRevision: input.currentRevision,
    approvedOperationIds: input.approvedOperationIds,
  });

  if (evaluation.status === 'refused') {
    return {
      status: 'refused',
      code: evaluation.code,
      detail: evaluation.detail,
      state: input.initialState,
      revision: input.currentRevision,
    };
  }

  const steps: readonly WallWorkflowStep<TState>[] = evaluation.operations.map((operation) => ({
    description: summaryFor(input.proposal, operation),
    operation,
    inverseOf: (outcome) => input.inverseOf(operation, outcome),
  }));

  // The label is the user's own words. "Undo proposal-4f2a" is not a sentence
  // anyone recognises.
  const label = input.proposal.provenance.userIntent;

  const outcome = commitWallWorkflow<TState>({
    label,
    undoStack: input.undoStack,
    steps,
    initialState: input.initialState,
    initialRevision: input.currentRevision,
    pipeline: input.pipeline,
  });

  if (outcome.status === 'rejected') {
    return {
      status: 'failed',
      code: outcome.code,
      detail: outcome.detail,
      failedOperationIndex: outcome.failedStep,
      state: outcome.state,
      revision: outcome.revision,
      reversals: outcome.reversals,
    };
  }

  return {
    status: 'applied',
    state: outcome.state,
    revision: outcome.revision,
    appliedOperationIds: evaluation.operations.map((operation) => operation.id),
    undoLabel: label,
  };
}

/** The proposer's own summary for an operation, so a failure message reads in the user's terms. */
function summaryFor(proposal: AiProposal, operation: ModelOperation): string {
  const entry = proposal.operations.find((candidate) => candidate.operation.id === operation.id);
  return entry?.summary ?? operation.type;
}

/**
 * How a surface should describe a proposal's state.
 *
 * Kept here rather than left to each surface because AC3-090's failure is a
 * proposal *shown* as applied, and that is a wording failure before it is a
 * logic one. A proposal that was approved but not yet applied is "approved",
 * never "applied"; one that failed part-way is "partly applied and reversed",
 * which is neither of the other two and needs its own word.
 */
export type ProposalPresentationState =
  'proposed' | 'approved' | 'applied' | 'reversed' | 'refused';

export function presentationStateFor<TState>(
  result: ApplyProposalResult<TState> | null,
  approved: boolean,
): ProposalPresentationState {
  if (result === null) {
    return approved ? 'approved' : 'proposed';
  }
  switch (result.status) {
    case 'applied':
      return 'applied';
    case 'failed':
      return 'reversed';
    case 'refused':
      return 'refused';
    default:
      return 'proposed';
  }
}
