/**
 * The proposal state machine, written as a machine rather than as a list of
 * names.
 *
 * The reviewed 2.0 package declared eleven proposal states and reached
 * four. `staged` was never produced - staging went straight to
 * `ready_for_review` or `validation_failed`. `expired` was never produced
 * because nothing measured age. `superseded` appeared only inside a
 * test-only commit helper. `approved`, `committing`, `rejected` and
 * `failed` had no transition into them at all. A state nothing can enter is
 * not a state; it is a comment that a reviewer will read as behaviour.
 *
 * Every state below is reachable and every transition is enumerated. Two
 * are additions rather than repairs:
 *
 * `cancelled` closes a real hole. 2.0 had no way for a caller to withdraw a
 * proposal it had already queued. An assistant that realised its plan was
 * wrong could only leave it sitting in the operator's review queue, or
 * stage a second one beside it. Withdrawal is not a dangerous power - it
 * removes a request, it does not change a project - and its absence pushed
 * callers towards the more dangerous alternative.
 *
 * `expired` is now produced by a clock the package controls, so a stale
 * proposal stops being reviewable rather than sitting in the queue against
 * a revision that moved hours ago.
 */

import type { CanonicalMutationState } from './envelope';
import type { ChangeSet } from './changeset';

export const PROPOSAL_STATES = [
  /** Accepted and being validated. Visible only if validation is asynchronous; the in-process host passes through it. */
  'staged',
  /** Deterministic validation rejected it. Terminal: build a new change set rather than editing this one. */
  'validation_failed',
  /** Validation passed. Nothing is queued for the operator yet. */
  'ready_for_review',
  /** Queued for the operator in Arq. Nothing has changed. */
  'awaiting_user_approval',
  /** The operator approved in Arq. Only Arq can enter this state. */
  'approved',
  /** Arq is applying the change inside its own transaction. */
  'committing',
  /** Arq committed it. The only state in which canonical project state changed. */
  'committed',
  /** The operator declined it. Terminal. */
  'rejected',
  /** The caller withdrew it before review completed. Terminal. */
  'cancelled',
  /** It sat unreviewed past its lifetime. Terminal. */
  'expired',
  /** The project moved on and a newer proposal covers the same ground. Terminal. */
  'superseded',
  /** Arq attempted the change and could not complete it. Terminal, and canonical state is unchanged. */
  'failed',
] as const;

export type ProposalState = (typeof PROPOSAL_STATES)[number];

export const TERMINAL_PROPOSAL_STATES: readonly ProposalState[] = [
  'validation_failed',
  'committed',
  'rejected',
  'cancelled',
  'expired',
  'superseded',
  'failed',
];

/**
 * The legal transitions. Read the right-hand side as "and nothing else":
 * a transition absent from this table cannot happen, including any path
 * from a review state directly to `committed` without Arq's approval and
 * commit steps in between.
 */
const TRANSITIONS: Readonly<Record<ProposalState, readonly ProposalState[]>> = {
  staged: ['ready_for_review', 'validation_failed', 'cancelled', 'expired'],
  validation_failed: [],
  ready_for_review: ['awaiting_user_approval', 'cancelled', 'expired', 'superseded'],
  awaiting_user_approval: ['approved', 'rejected', 'cancelled', 'expired', 'superseded'],
  approved: ['committing', 'superseded', 'expired'],
  committing: ['committed', 'failed'],
  committed: [],
  rejected: [],
  cancelled: [],
  expired: [],
  superseded: [],
  failed: [],
};

export function canTransition(from: ProposalState, to: ProposalState): boolean {
  return TRANSITIONS[from].includes(to);
}

export function isTerminal(state: ProposalState): boolean {
  return TERMINAL_PROPOSAL_STATES.includes(state);
}

/** The states a caller may still withdraw from. Withdrawing removes a request; it never touches a project. */
export function canCancel(state: ProposalState): boolean {
  return canTransition(state, 'cancelled');
}

/** True only for `committed`. Everything else, including `failed`, left canonical state exactly as it was. */
export function canonicalMutationFor(state: ProposalState): CanonicalMutationState {
  return state === 'committed' ? 'committed_by_arq' : 'none';
}

export type ApprovalState = 'not_requested' | 'awaiting_user' | 'approved' | 'rejected' | 'expired';

export interface ValidationIssueRecord {
  readonly code: string;
  readonly severity: 'error' | 'warning' | 'info';
  readonly title: string;
  readonly message: string;
  readonly operationId?: string;
  readonly affectedElementIds: readonly string[];
  readonly suggestedActions: readonly string[];
}

export interface ProposalValidation {
  readonly status: 'passed' | 'failed';
  /** The catalogue revision the operations were checked against, so a later catalogue change is detectable. */
  readonly catalogRevision: string;
  readonly errors: readonly ValidationIssueRecord[];
  readonly warnings: readonly ValidationIssueRecord[];
  readonly affectedElementIds: readonly string[];
  readonly expectedInvalidations: readonly string[];
  /** Preview surfaces Arq can render for this proposal. Empty means the reviewer sees data, and the UI must say so rather than showing nothing. */
  readonly availablePreviews: readonly string[];
}

export interface ProposalApproval {
  readonly required: boolean;
  readonly state: ApprovalState;
  /** Where the operator reviews it, as an `arq://review/...` handle. Never a URL a client can act on itself. */
  readonly reviewUri?: string;
}

export interface ProposalCanonicalMutation {
  readonly state: CanonicalMutationState;
  readonly revisionBefore: string;
  readonly revisionAfter?: string;
  readonly undoGroupId?: string;
}

export interface Proposal {
  readonly proposalId: string;
  readonly changeSetId: string;
  readonly projectId: string;
  readonly proposalHash: string;
  readonly state: ProposalState;
  readonly changeSet: ChangeSet;
  readonly validation: ProposalValidation;
  readonly approval: ProposalApproval;
  readonly canonicalMutation: ProposalCanonicalMutation;
  readonly stagedAtEpochMs: number;
  readonly expiresAtEpochMs: number;
  readonly stateChangedAtEpochMs: number;
}

/**
 * Plain-language state, for a tool result and for the Review Centre.
 *
 * Every string says what did or did not happen to the project, because the
 * one thing a reader must never have to infer is whether their drawing
 * changed.
 */
export function describeProposalState(state: ProposalState): string {
  switch (state) {
    case 'staged':
      return 'The change set was accepted and is being validated. Nothing in the project has changed.';
    case 'validation_failed':
      return 'The change set did not pass validation, so it was not queued for review. Nothing in the project has changed.';
    case 'ready_for_review':
      return 'The change set passed validation and can be sent for review in Arq. Nothing in the project has changed.';
    case 'awaiting_user_approval':
      return 'The proposal is waiting for a decision in Arq. Nothing in the project has changed.';
    case 'approved':
      return 'The operator approved the proposal in Arq. Arq has not applied it yet.';
    case 'committing':
      return 'Arq is applying the proposal inside its own transaction.';
    case 'committed':
      return 'Arq applied the proposal. The project moved to a new revision and the change can be undone as one group.';
    case 'rejected':
      return 'The operator declined the proposal in Arq. Nothing in the project has changed.';
    case 'cancelled':
      return 'The proposal was withdrawn before a decision was made. Nothing in the project has changed.';
    case 'expired':
      return 'The proposal was not reviewed within its lifetime and is no longer valid. Nothing in the project has changed.';
    case 'superseded':
      return 'A later change replaced what this proposal was built on, so it can no longer be applied. Nothing in the project has changed.';
    case 'failed':
      return 'Arq could not complete the change. The project is exactly as it was before the attempt.';
  }
}

/** What the caller should do next, given the state. Paired with `describeProposalState` on every proposal result. */
export function proposalNextAction(state: ProposalState): string {
  switch (state) {
    case 'staged':
      return 'Read the proposal again to see the validation result.';
    case 'validation_failed':
      return 'Read the validation errors, correct the change set, and stage it under a new change-set id.';
    case 'ready_for_review':
      return 'Call arq_request_changeset_review to queue it for the operator, or arq_cancel_changeset to withdraw it.';
    case 'awaiting_user_approval':
      return 'Wait for the operator to decide in Arq. Do not restage the same change, and do not report it as applied.';
    case 'approved':
      return 'Wait for Arq to apply it. Approval is not application.';
    case 'committing':
      return 'Wait for Arq to finish. Read the proposal again for the committed revision.';
    case 'committed':
      return 'Read the project snapshot for the new revision before proposing anything further.';
    case 'rejected':
      return 'Ask the operator what to change. Do not restage the same proposal.';
    case 'cancelled':
      return 'Build a new change set if the work is still wanted.';
    case 'expired':
      return 'Refresh the project revision and stage a new change set if the work is still wanted.';
    case 'superseded':
      return 'Read the current snapshot and rebuild the change set against the new revision.';
    case 'failed':
      return 'Report the trace identifier. Do not retry until the operator has looked at the project.';
  }
}
