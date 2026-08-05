import type { ElementId } from '@arq/bim-core';
import type { DerivedInvalidation, ModelOperation, OperationResult } from './operation';
import { hasErrors, type ValidationMessage } from './validation-result';

/**
 * V3-046 to V3-057: the one path a change takes to become committed project
 * state.
 *
 * The individual operations in this package are already pure - they take a
 * state and return the next one. What did not exist was the sequence around
 * them: check the operation is not stale, evaluate its preconditions, apply it,
 * validate the *candidate* rather than the inputs, commit inside one
 * transaction, and advance the revision only if that transaction succeeded.
 * Without one place that owns that order, each caller invents its own, and the
 * orders differ in exactly the ways that matter - validating before applying
 * instead of after, advancing a revision before a commit confirms, treating a
 * failed commit as a warning.
 *
 * The invariant this exists to hold is `.zeus/FAST-KERNEL.md`'s: an invalid
 * operation leaves committed state and revision unchanged. That is enforced
 * structurally rather than by discipline - every rejection returns the caller's
 * *original* state and revision, so a caller that reads the outcome cannot
 * accidentally keep a half-applied candidate. The candidate only escapes this
 * function when the commit confirmed it.
 */

/**
 * Stable codes (V3-053). They are part of the contract: diagnostics, telemetry
 * and support text key off them, so they are strings a caller can switch on
 * rather than prose that can be reworded.
 */
export const OPERATION_REJECTION_CODES = {
  notWritable: 'ARQ_OP_NOT_WRITABLE',
  staleBaseRevision: 'ARQ_OP_STALE_BASE_REVISION',
  wrongProject: 'ARQ_OP_WRONG_PROJECT',
  preconditionFailed: 'ARQ_OP_PRECONDITION_FAILED',
  validationFailed: 'ARQ_OP_VALIDATION_FAILED',
  applyRejected: 'ARQ_OP_APPLY_REJECTED',
  commitFailed: 'ARQ_OP_COMMIT_FAILED',
  revisionInvariant: 'ARQ_OP_REVISION_INVARIANT',
} as const;

export type OperationRejectionCode =
  (typeof OPERATION_REJECTION_CODES)[keyof typeof OPERATION_REJECTION_CODES];

/**
 * Where a committed change came from (V3-055). Recorded on every commit because
 * "who changed this" stops being answerable the moment AI proposals, scripts
 * and replayed recovery all commit through the same pipeline - which is exactly
 * what this pipeline requires them to do.
 */
export type OperationSource = 'user' | 'ai' | 'plugin' | 'script' | 'recovery' | 'import';

export interface OperationProvenance {
  readonly operationId: string;
  readonly operationType: string;
  readonly actorId: string;
  readonly source: OperationSource;
  readonly baseRevision: number;
  readonly committedRevision: number;
  readonly timestamp: string;
}

/** What a pure operation hands back. Mirrors the shape the operations here already return. */
export type OperationApplyOutcome<TState> =
  | { readonly status: 'applied'; readonly state: TState; readonly result: OperationResult }
  | { readonly status: 'rejected'; readonly result: OperationResult };

/** The canonical transaction. Returns the revision the store is on afterwards. */
export type OperationCommitOutcome =
  | { readonly status: 'committed'; readonly revision: number }
  | { readonly status: 'rejected'; readonly reason: string };

export interface CommitOperationInput<TState> {
  readonly state: TState;
  readonly operation: ModelOperation;
  /** The revision the canonical store is actually on, read fresh - not remembered. */
  readonly currentRevision: number;
  readonly writable: boolean;
  readonly source: OperationSource;
  readonly apply: (state: TState, operation: ModelOperation) => OperationApplyOutcome<TState>;
  /**
   * Validates the candidate produced by `apply`, not the operation's inputs. An
   * operation is only ever invalid in terms of the state it would create, and
   * checking beforehand cannot see the interactions the change introduces.
   */
  readonly validate?: (
    candidate: TState,
    operation: ModelOperation,
  ) => readonly ValidationMessage[];
  /** Evaluates one declared precondition against current state. */
  readonly checkPrecondition?: (
    state: TState,
    precondition: ModelOperation['preconditions'][number],
  ) => boolean;
  readonly commit: (candidate: TState, operation: ModelOperation) => OperationCommitOutcome;
}

export type CommitOperationOutcome<TState> =
  | {
      readonly status: 'committed';
      readonly state: TState;
      readonly revision: number;
      readonly result: OperationResult;
      readonly provenance: OperationProvenance;
      /** Bounded to the elements this operation actually touched (V3-057). */
      readonly invalidations: readonly DerivedInvalidation[];
      readonly validationMessages: readonly ValidationMessage[];
    }
  | {
      readonly status: 'rejected';
      readonly code: OperationRejectionCode;
      readonly detail: string;
      /** The caller's original state, unchanged. Never a candidate. */
      readonly state: TState;
      /** The caller's original revision, unchanged. */
      readonly revision: number;
      readonly validationMessages: readonly ValidationMessage[];
    };

/**
 * Runs one operation through the full commit sequence.
 *
 * The order is the point, and each step is placed where it is for a reason:
 * writability and staleness are checked before any work, because applying an
 * operation that can never commit wastes the work and risks a caller keeping
 * the candidate; preconditions are checked against the *current* state, since
 * that is what they assert about; validation runs on the candidate, since that
 * is the only state whose validity is in question; and the revision is read
 * back from the commit rather than incremented locally, so a store that
 * committed something different is caught instead of assumed.
 */
export function commitOperation<TState>(
  input: CommitOperationInput<TState>,
): CommitOperationOutcome<TState> {
  const { state, operation, currentRevision } = input;

  const reject = (
    code: OperationRejectionCode,
    detail: string,
    validationMessages: readonly ValidationMessage[] = [],
  ): CommitOperationOutcome<TState> => ({
    status: 'rejected',
    code,
    detail,
    // Deliberately the inputs, never a candidate.
    state,
    revision: currentRevision,
    validationMessages,
  });

  if (!input.writable) {
    return reject(OPERATION_REJECTION_CODES.notWritable, 'this project is open for reading only');
  }

  // V3-056. An operation built on a revision the store has moved past was
  // validated against state that no longer exists, so committing it would apply
  // an edit whose assumptions were never checked. Rejecting is not a
  // conservatism: it is the only answer that does not silently reinterpret the
  // user's intent against different state.
  if (operation.baseRevision !== currentRevision) {
    return reject(
      OPERATION_REJECTION_CODES.staleBaseRevision,
      `operation was built on revision ${operation.baseRevision} but the project is on ${currentRevision}`,
    );
  }

  if (input.checkPrecondition) {
    for (const precondition of operation.preconditions) {
      if (!input.checkPrecondition(state, precondition)) {
        return reject(
          OPERATION_REJECTION_CODES.preconditionFailed,
          `precondition "${precondition.kind}" does not hold`,
        );
      }
    }
  }

  let applied: OperationApplyOutcome<TState>;
  try {
    applied = input.apply(state, operation);
  } catch (error) {
    // A throwing operation is a rejected one. Letting it escape would leave the
    // caller with no outcome to read and no statement about whether anything
    // committed.
    return reject(OPERATION_REJECTION_CODES.applyRejected, messageOf(error));
  }

  if (applied.status === 'rejected') {
    return reject(
      OPERATION_REJECTION_CODES.applyRejected,
      'the operation did not apply',
      applied.result.validationMessages,
    );
  }

  const candidate = applied.state;
  const validationMessages = input.validate
    ? [...applied.result.validationMessages, ...input.validate(candidate, operation)]
    : applied.result.validationMessages;

  // Errors block; warnings and info do not. A warning that blocked would make
  // the two severities the same thing under different names.
  if (hasErrors(validationMessages)) {
    return reject(
      OPERATION_REJECTION_CODES.validationFailed,
      'the resulting project would not be valid',
      validationMessages,
    );
  }

  let committed: OperationCommitOutcome;
  try {
    committed = input.commit(candidate, operation);
  } catch (error) {
    return reject(OPERATION_REJECTION_CODES.commitFailed, messageOf(error), validationMessages);
  }

  if (committed.status === 'rejected') {
    return reject(OPERATION_REJECTION_CODES.commitFailed, committed.reason, validationMessages);
  }

  // V3-052, checked rather than trusted. A store that reports a revision which
  // did not move forward has not committed what this pipeline just handed it,
  // and adopting the candidate on its say-so would make the in-memory state and
  // the canonical store disagree with nothing detecting it.
  if (committed.revision <= currentRevision) {
    return reject(
      OPERATION_REJECTION_CODES.revisionInvariant,
      `commit reported revision ${committed.revision}, which does not advance past ${currentRevision}`,
      validationMessages,
    );
  }

  return {
    status: 'committed',
    state: candidate,
    revision: committed.revision,
    result: applied.result,
    provenance: {
      operationId: operation.id,
      operationType: operation.type,
      actorId: operation.actorId,
      source: input.source,
      baseRevision: operation.baseRevision,
      committedRevision: committed.revision,
      timestamp: operation.timestamp,
    },
    invalidations: boundInvalidations(applied.result),
    validationMessages,
  };
}

/**
 * V3-057: keeps invalidation to the elements the operation actually touched.
 *
 * An operation that reports invalidating elements it never affected causes
 * derived work - retessellation, re-render, re-index - for elements that did not
 * change. Dropping those entries is safe in the direction that matters: this
 * narrows what is thrown away, and never widens what is kept.
 */
export function boundInvalidations(result: OperationResult): readonly DerivedInvalidation[] {
  const affected = new Set<ElementId>(result.affectedElementIds);
  const bounded: DerivedInvalidation[] = [];
  for (const invalidation of result.invalidations) {
    const elementIds = invalidation.elementIds.filter((id) => affected.has(id));
    if (elementIds.length > 0) {
      bounded.push({ kind: invalidation.kind, elementIds });
    }
  }
  return bounded;
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
