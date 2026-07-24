import {
  classifyConflict,
  type ConflictClass,
  type TouchedEntities,
} from './conflict-classification';

/**
 * ARQ-209: safe rebase. Given the server operations that landed after a client's
 * baseRevision and the client's own pending operations, determines which client
 * operations can be safely replayed onto the new head and which are conflicted -
 * never silently reapplying or silently dropping a conflicted operation, matching
 * "invalid operations leave committed state unchanged."
 *
 * Each client operation is checked independently against every server operation.
 * This does NOT chase transitive dependency chains between a client's own pending
 * operations (e.g. "operation B was written assuming operation A's effect, and A
 * conflicted, so B might now be unsafe too even if B itself touches nothing server-
 * side changed") - that needs real operation semantics this generic, payload-agnostic
 * module does not have. Documented as a real scope boundary, not silently assumed
 * away.
 */
export interface RebaseCandidate {
  readonly operationId: string;
  readonly touched: TouchedEntities;
}

export type RebaseOutcome =
  | { readonly operationId: string; readonly status: 'safe-to-rebase' }
  | {
      readonly operationId: string;
      readonly status: 'conflicted';
      readonly conflictClass: ConflictClass;
      readonly conflictingServerOperationId: string;
    };

export function computeSafeRebasePlan(
  clientOperations: readonly RebaseCandidate[],
  serverOperationsSinceBase: readonly RebaseCandidate[],
): readonly RebaseOutcome[] {
  return clientOperations.map((clientOp) => {
    for (const serverOp of serverOperationsSinceBase) {
      const conflictClass = classifyConflict(clientOp.touched, serverOp.touched);
      if (conflictClass !== 'no-conflict') {
        return {
          operationId: clientOp.operationId,
          status: 'conflicted',
          conflictClass,
          conflictingServerOperationId: serverOp.operationId,
        };
      }
    }
    return { operationId: clientOp.operationId, status: 'safe-to-rebase' };
  });
}
