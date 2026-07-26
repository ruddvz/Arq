/**
 * ARQ-135: build history group.
 *
 * docs/product/ARQ-COMPLETE-PRODUCT-ENGINEERING-BLUEPRINT-v1.0.md section
 * 12 ("Right inspector") lists "History" as its own group, closing out
 * the Inspection epic (ARQ-130 through this issue). Like ARQ-134's
 * Warnings group, this lives in @arq/operations rather than bim-core:
 * the data is ModelOperation/OperationResult (operation.ts, ARQ-065),
 * which already live here, and bim-core must not depend on operations.
 *
 * A project's applied-operation log was never computed with "one
 * element's inspector panel" in mind - each OperationResult just lists
 * every affectedElementIds it touched (the same shape ARQ-134's
 * WarningsPropertyGroup already filters by). buildHistoryPropertyGroup
 * is that same filtering step for history: given one element's id and
 * the project's full applied-operation log, keep only the entries that
 * actually affected this element, reduced to the fields an inspector
 * row needs (which operation, who, when) rather than the full
 * ModelOperation payload - a caller wanting more detail already has the
 * original entries to look up by operationId.
 *
 * Ordered most-recent-first (a plain descending sort on the ISO 8601
 * timestamp string, which sorts correctly lexicographically) since an
 * activity history is read newest-first, with a stable sort so entries
 * sharing a timestamp keep the log's own order rather than being
 * silently reordered.
 *
 * Deliberately excludes persisting the applied-operation log itself
 * (that is section 71's "journal and snapshots", a distinct and larger
 * concern this issue's "do not expand into later release scope"
 * non-goal rules out) - this module only shapes a log a caller already
 * has into the group the inspector renders.
 */

import type { ElementId } from '@arq/bim-core';
import type { ModelOperation, OperationResult } from './operation';

export interface HistoryEntry {
  readonly operationId: string;
  readonly type: string;
  readonly actorId: string;
  readonly timestamp: string;
}

export interface HistoryPropertyGroup {
  readonly entries: readonly HistoryEntry[];
}

export interface AppliedOperationLogEntry {
  readonly operation: ModelOperation;
  readonly result: OperationResult;
}

/** Filters `appliedLog` down to the entries that affected `elementId`, ordered most-recent-first. */
export function buildHistoryPropertyGroup(
  elementId: ElementId,
  appliedLog: readonly AppliedOperationLogEntry[],
): HistoryPropertyGroup {
  const relevant = appliedLog.filter(
    ({ result }) => result.status === 'applied' && result.affectedElementIds.includes(elementId),
  );
  const entries = relevant.map(({ operation }): HistoryEntry => ({
    operationId: operation.id,
    type: operation.type,
    actorId: operation.actorId,
    timestamp: operation.timestamp,
  }));
  return { entries: stableSortDescendingByTimestamp(entries) };
}

function stableSortDescendingByTimestamp(
  entries: readonly HistoryEntry[],
): readonly HistoryEntry[] {
  return entries
    .map((entry, index) => ({ entry, index }))
    .sort((a, b) => {
      if (a.entry.timestamp !== b.entry.timestamp) {
        return a.entry.timestamp < b.entry.timestamp ? 1 : -1;
      }
      return a.index - b.index;
    })
    .map(({ entry }) => entry);
}
