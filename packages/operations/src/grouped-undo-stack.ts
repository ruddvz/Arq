import { DEFAULT_UNDO_STACK_DEPTH, type UndoStackEntry } from './undo-stack';

/**
 * V3-054: undo grouped by user intent rather than by operation.
 *
 * `undo-stack.ts` stores one (forward, inverse) pair per entry, which is right
 * when one gesture is one operation. It stops being right as soon as a gesture
 * is not: drawing a wall into a room splits the room and adjusts two joins,
 * placing a door creates an opening and a door instance, and an AI proposal may
 * apply a dozen operations at once. Undoing those one at a time makes the user
 * press undo repeatedly to reverse a single thing they did, and leaves the
 * project in states that never existed as far as they are concerned - a wall
 * removed but the room still split.
 *
 * So the unit of undo here is a group with a label, and the label is the user's
 * word for what they did. A group that contains one operation behaves exactly
 * like the ungrouped stack, so nothing is lost by the generalisation.
 */

export interface UndoGroup<TOperation> {
  /** The user's word for the gesture, used by the undo affordance. */
  readonly label: string;
  readonly entries: readonly UndoStackEntry<TOperation>[];
}

export interface GroupedUndoStack<TOperation> {
  /** Opens a group. Operations recorded until `endGroup` undo together. */
  beginGroup(label: string): void;
  /**
   * Records an applied operation and its inverse. Inside a group it joins that
   * group; outside one it becomes a single-operation group of its own, so a
   * caller that never groups still gets correct behaviour.
   */
  record(entry: UndoStackEntry<TOperation>, label?: string): void;
  /** Closes the open group. An empty group is discarded rather than pushed. */
  endGroup(): void;
  /**
   * Drops the open group without pushing it. For a gesture the user cancelled:
   * the operations still have to be reversed by the caller, but they were never
   * a thing the user did, so they must not appear in the undo history.
   */
  abandonGroup(): readonly UndoStackEntry<TOperation>[];
  isGroupOpen(): boolean;
  canUndo(): boolean;
  canRedo(): boolean;
  /** The label of the next group undo would reverse, for the affordance's text. */
  peekUndoLabel(): string | null;
  peekRedoLabel(): string | null;
  /** Inverses to apply, newest first. Empty when there is nothing to undo. */
  undo(): readonly TOperation[];
  /** Forwards to re-apply, in their original order. */
  redo(): readonly TOperation[];
  depth(): number;
}

export function createGroupedUndoStack<TOperation>(
  maxDepth: number = DEFAULT_UNDO_STACK_DEPTH,
): GroupedUndoStack<TOperation> {
  const undoStack: UndoGroup<TOperation>[] = [];
  let redoStack: UndoGroup<TOperation>[] = [];
  let openLabel: string | null = null;
  let openEntries: UndoStackEntry<TOperation>[] = [];

  function pushGroup(group: UndoGroup<TOperation>): void {
    if (group.entries.length === 0) {
      return;
    }
    undoStack.push(group);
    if (undoStack.length > maxDepth) {
      undoStack.shift();
    }
    // Doing something new after undoing discards the undone work, the standard
    // rule the ungrouped stack already follows.
    redoStack = [];
  }

  return {
    beginGroup(label: string): void {
      // An unclosed group when a new one begins is a caller bug, but losing the
      // operations would be worse than closing it: they were applied, so they
      // must remain reversible.
      if (openLabel !== null) {
        pushGroup({ label: openLabel, entries: openEntries });
      }
      openLabel = label;
      openEntries = [];
    },

    record(entry: UndoStackEntry<TOperation>, label?: string): void {
      if (openLabel !== null) {
        openEntries.push(entry);
        return;
      }
      pushGroup({ label: label ?? 'Change', entries: [entry] });
    },

    endGroup(): void {
      if (openLabel === null) {
        return;
      }
      pushGroup({ label: openLabel, entries: openEntries });
      openLabel = null;
      openEntries = [];
    },

    abandonGroup(): readonly UndoStackEntry<TOperation>[] {
      const abandoned = openEntries;
      openLabel = null;
      openEntries = [];
      return abandoned;
    },

    isGroupOpen(): boolean {
      return openLabel !== null;
    },

    canUndo(): boolean {
      return undoStack.length > 0;
    },

    canRedo(): boolean {
      return redoStack.length > 0;
    },

    peekUndoLabel(): string | null {
      return undoStack[undoStack.length - 1]?.label ?? null;
    },

    peekRedoLabel(): string | null {
      return redoStack[redoStack.length - 1]?.label ?? null;
    },

    undo(): readonly TOperation[] {
      const group = undoStack.pop();
      if (!group) {
        return [];
      }
      redoStack.push(group);
      // Reverse order. Applying a group's inverses forwards would undo the
      // first operation against state the later ones had already changed, which
      // is the classic way a grouped undo lands somewhere the project has never
      // been.
      return [...group.entries].reverse().map((entry) => entry.inverse);
    },

    redo(): readonly TOperation[] {
      const group = redoStack.pop();
      if (!group) {
        return [];
      }
      undoStack.push(group);
      return group.entries.map((entry) => entry.forward);
    },

    depth(): number {
      return undoStack.length;
    },
  };
}
