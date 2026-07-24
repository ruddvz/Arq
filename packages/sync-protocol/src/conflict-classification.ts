/**
 * ARQ-209: conflict classes. Operations here are described only by which entity IDs
 * they wrote or deleted - not their full semantic type - so this module works for
 * any typed-operation source without depending on @arq/operations/@arq/arqscript
 * concretely (matching operation-envelope.ts's own decoupling). This is a real,
 * standard optimistic-concurrency conflict-detection pattern (compare touched-entity
 * sets), not a placeholder.
 */
export interface TouchedEntities {
  readonly writes: ReadonlySet<string>;
  readonly deletes: ReadonlySet<string>;
}

export type ConflictClass =
  /** No overlap between the two operations' touched entities - safe to apply both. */
  | 'no-conflict'
  /** Both operations wrote to the same entity, neither deleted it - a real conflict, but a mergeable one in principle (e.g. two property edits). */
  | 'concurrent-write'
  /** One operation deleted an entity the other wrote to - qualitatively different and usually not mergeable: the write's target may no longer exist. */
  | 'write-after-delete';

function intersects(a: ReadonlySet<string>, b: ReadonlySet<string>): boolean {
  for (const value of a) {
    if (b.has(value)) {
      return true;
    }
  }
  return false;
}

/** Order of the two arguments does not matter - classification is symmetric. */
export function classifyConflict(a: TouchedEntities, b: TouchedEntities): ConflictClass {
  if (
    intersects(a.deletes, b.writes) ||
    intersects(b.deletes, a.writes) ||
    intersects(a.deletes, b.deletes)
  ) {
    return 'write-after-delete';
  }
  if (intersects(a.writes, b.writes)) {
    return 'concurrent-write';
  }
  return 'no-conflict';
}
