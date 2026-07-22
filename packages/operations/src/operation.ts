/**
 * ARQ-065: define operation contract.
 *
 * Mirrors contracts/operations.ts's existing ModelOperation/
 * OperationResult/OperationPrecondition shapes (same duplication
 * rationale as bim-core's ids.ts/level.ts - contracts/ isn't wired up as
 * an importable workspace package yet), matching the blueprint's section
 * 67 "Operation contract" and the framing quote there: "Operations are
 * data, not executable closures in stored files."
 *
 * OperationResult.inverse is what the undo stack (undo-stack.ts,
 * ARQ-056/057) stores as the "inverse" half of each (forward, inverse)
 * pair - a successfully applied operation's inverse is itself just
 * another ModelOperation, ready to be pushed onto the stack and, later,
 * applied the same way any operation is.
 *
 * One deliberate deviation from contracts/operations.ts: ModelOperation's
 * default payload type is `unknown`, not
 * `Readonly<Record<string, unknown>>`. A concrete payload interface
 * without an index signature (every payload defined so far -
 * CreateElementPayload, DeleteElementPayload, UpdatePropertyPayload) is
 * not structurally assignable to Record<string, unknown> in strict mode,
 * which made OperationResult.inverse (typed as the untyped
 * ModelOperation) impossible to construct or narrow back without
 * "as unknown as" everywhere. `unknown` avoids that friction while still
 * requiring an explicit narrowing step before a caller can read a
 * specific payload's fields.
 */

import type { Brand, ElementId, ProjectId } from '@arq/bim-core';
import type { ValidationMessage } from './validation-result';

export type OperationId = Brand<string, 'OperationId'>;

export function operationId(value: string): OperationId {
  return value as OperationId;
}

export interface OperationPrecondition {
  readonly kind: string;
  readonly payload: Readonly<Record<string, unknown>>;
}

export interface ModelOperation<TPayload = unknown> {
  readonly id: OperationId;
  readonly type: string;
  readonly actorId: string;
  readonly projectId: ProjectId;
  readonly baseRevision: number;
  readonly timestamp: string;
  readonly payload: TPayload;
  readonly preconditions: readonly OperationPrecondition[];
}

export interface DerivedInvalidation {
  readonly kind: string;
  readonly elementIds: readonly ElementId[];
}

export interface OperationResult<TResult = unknown> {
  readonly status: 'applied' | 'rejected';
  readonly result?: TResult;
  readonly affectedElementIds: readonly ElementId[];
  readonly invalidations: readonly DerivedInvalidation[];
  readonly validationMessages: readonly ValidationMessage[];
  readonly inverse?: ModelOperation;
  readonly durationMs: number;
}

export function rejectedResult<TResult = never>(
  validationMessages: readonly ValidationMessage[],
  durationMs: number,
): OperationResult<TResult> {
  return {
    status: 'rejected',
    affectedElementIds: [],
    invalidations: [],
    validationMessages,
    durationMs,
  };
}
