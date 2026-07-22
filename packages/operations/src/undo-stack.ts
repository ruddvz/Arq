/**
 * ARQ-056: implement undo command stack. ARQ-057: implement redo.
 *
 * A generic undo/redo stack over pairs of (forward, inverse) operations,
 * matching contracts/operations.ts's OperationResult.inverse pattern
 * (every successfully applied ModelOperation yields an inverse
 * ModelOperation) without importing contracts/operations.ts directly -
 * that directory isn't wired up as an importable workspace package yet
 * (no package.json, no tsconfig path alias, and nothing else in the
 * monorepo imports from it either), and adding that wiring is a separate
 * structural decision, not a side effect of this issue. This module is
 * generic over the operation type (`TOperation`) so it slots in as soon
 * as that wiring exists, with no change needed here.
 *
 * Pushing a new entry clears the redo stack - the standard rule that
 * once you've undone something and then do something new, the undone
 * work can no longer be redone.
 *
 * docs/ux/KEYBOARD-SHORTCUTS.md documents Cmd/Ctrl+Z for undo and
 * Cmd/Ctrl+Shift+Z for redo - ordinary shortcuts routed through
 * createKeyboardShortcutRegistry (ARQ-037), not Escape/Enter. Escape and
 * Enter have no special interaction with the undo stack itself: an
 * undo/redo call either succeeds (applying the inverse/forward operation)
 * or is a no-op on an empty stack - there is no in-progress preview for
 * Escape to cancel or Enter to commit.
 */

export interface UndoStackEntry<TOperation> {
  readonly forward: TOperation;
  readonly inverse: TOperation;
}

/** Provisional default depth (not a designed product decision) - a caller can override it. */
export const DEFAULT_UNDO_STACK_DEPTH = 100;

export function createUndoStack<TOperation>(maxDepth: number = DEFAULT_UNDO_STACK_DEPTH) {
  let undoStack: UndoStackEntry<TOperation>[] = [];
  let redoStack: UndoStackEntry<TOperation>[] = [];

  /** Records a newly applied operation and its inverse; clears the redo stack. */
  function push(entry: UndoStackEntry<TOperation>): void {
    undoStack.push(entry);
    if (undoStack.length > maxDepth) {
      undoStack.shift();
    }
    redoStack = [];
  }

  function canUndo(): boolean {
    return undoStack.length > 0;
  }

  function canRedo(): boolean {
    return redoStack.length > 0;
  }

  /** Pops the most recent entry and returns its inverse operation to apply, or null if there is nothing to undo. */
  function undo(): TOperation | null {
    const entry = undoStack.pop();
    if (!entry) {
      return null;
    }
    redoStack.push(entry);
    return entry.inverse;
  }

  /** Pops the most recently undone entry and returns its forward operation to re-apply, or null if there is nothing to redo. */
  function redo(): TOperation | null {
    const entry = redoStack.pop();
    if (!entry) {
      return null;
    }
    undoStack.push(entry);
    return entry.forward;
  }

  function clear(): void {
    undoStack = [];
    redoStack = [];
  }

  return { push, undo, redo, canUndo, canRedo, clear };
}
