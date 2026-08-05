import { describe, expect, it } from 'vitest';
import { createGroupedUndoStack } from './grouped-undo-stack';

/** A stand-in operation: the stack is generic and never inspects it. */
interface Op {
  readonly name: string;
}

function pair(name: string): { forward: Op; inverse: Op } {
  return { forward: { name }, inverse: { name: `un-${name}` } };
}

describe('createGroupedUndoStack', () => {
  it('treats an ungrouped operation as its own group', () => {
    const stack = createGroupedUndoStack<Op>();
    stack.record(pair('a'));

    expect(stack.canUndo()).toBe(true);
    expect(stack.undo()).toEqual([{ name: 'un-a' }]);
    expect(stack.canUndo()).toBe(false);
  });

  it('reverses a whole gesture in one undo', () => {
    const stack = createGroupedUndoStack<Op>();
    stack.beginGroup('Draw wall');
    stack.record(pair('create-wall'));
    stack.record(pair('split-room'));
    stack.record(pair('join-ends'));
    stack.endGroup();

    expect(stack.depth()).toBe(1);
    expect(stack.undo()).toEqual([
      { name: 'un-join-ends' },
      { name: 'un-split-room' },
      { name: 'un-create-wall' },
    ]);
  });

  /**
   * The classic grouped-undo bug. Applying a group's inverses forwards undoes
   * the first operation against state the later ones had already changed, and
   * lands the project somewhere it has never been.
   */
  it('returns inverses newest first, not in application order', () => {
    const stack = createGroupedUndoStack<Op>();
    stack.beginGroup('Place door');
    stack.record(pair('create-opening'));
    stack.record(pair('create-door'));
    stack.endGroup();

    expect(stack.undo()).toEqual([{ name: 'un-create-door' }, { name: 'un-create-opening' }]);
  });

  it('redoes a group in its original application order', () => {
    const stack = createGroupedUndoStack<Op>();
    stack.beginGroup('Place door');
    stack.record(pair('create-opening'));
    stack.record(pair('create-door'));
    stack.endGroup();
    stack.undo();

    expect(stack.redo()).toEqual([{ name: 'create-opening' }, { name: 'create-door' }]);
  });

  it('names the gesture so the undo affordance can say what it reverses', () => {
    const stack = createGroupedUndoStack<Op>();
    stack.beginGroup('Draw wall');
    stack.record(pair('a'));
    stack.endGroup();

    expect(stack.peekUndoLabel()).toBe('Draw wall');
    stack.undo();
    expect(stack.peekUndoLabel()).toBeNull();
    expect(stack.peekRedoLabel()).toBe('Draw wall');
  });

  it('discards an empty group rather than pushing a no-op onto the history', () => {
    const stack = createGroupedUndoStack<Op>();
    stack.beginGroup('Nothing happened');
    stack.endGroup();

    expect(stack.canUndo()).toBe(false);
    expect(stack.depth()).toBe(0);
  });

  /**
   * A cancelled gesture: the operations still have to be reversed by the
   * caller, but they were never a thing the user did, so they must not appear
   * in the undo history.
   */
  it('abandons a cancelled gesture and hands its entries back for reversal', () => {
    const stack = createGroupedUndoStack<Op>();
    stack.beginGroup('Draw wall');
    stack.record(pair('create-wall'));
    stack.record(pair('split-room'));

    const abandoned = stack.abandonGroup();

    expect(abandoned).toHaveLength(2);
    expect(stack.canUndo()).toBe(false);
    expect(stack.isGroupOpen()).toBe(false);
  });

  it('does something new after an undo, and the undone work stops being redoable', () => {
    const stack = createGroupedUndoStack<Op>();
    stack.record(pair('a'));
    stack.undo();
    expect(stack.canRedo()).toBe(true);

    stack.record(pair('b'));

    expect(stack.canRedo()).toBe(false);
  });

  /**
   * Closing an unclosed group is a caller bug, but losing the operations would
   * be worse: they were applied, so they must stay reversible.
   */
  it('closes an unclosed group rather than losing its operations', () => {
    const stack = createGroupedUndoStack<Op>();
    stack.beginGroup('First');
    stack.record(pair('a'));
    stack.beginGroup('Second');
    stack.record(pair('b'));
    stack.endGroup();

    expect(stack.depth()).toBe(2);
    expect(stack.undo()).toEqual([{ name: 'un-b' }]);
    expect(stack.undo()).toEqual([{ name: 'un-a' }]);
  });

  it('bounds history depth, dropping the oldest gesture first', () => {
    const stack = createGroupedUndoStack<Op>(2);
    stack.record(pair('a'), 'A');
    stack.record(pair('b'), 'B');
    stack.record(pair('c'), 'C');

    expect(stack.depth()).toBe(2);
    expect(stack.peekUndoLabel()).toBe('C');
    stack.undo();
    stack.undo();
    expect(stack.canUndo()).toBe(false);
  });

  it('returns nothing to apply when there is nothing to undo or redo', () => {
    const stack = createGroupedUndoStack<Op>();

    expect(stack.undo()).toEqual([]);
    expect(stack.redo()).toEqual([]);
  });

  it('reports whether a gesture is currently open', () => {
    const stack = createGroupedUndoStack<Op>();
    expect(stack.isGroupOpen()).toBe(false);

    stack.beginGroup('Draw wall');
    expect(stack.isGroupOpen()).toBe(true);

    stack.endGroup();
    expect(stack.isGroupOpen()).toBe(false);
  });
});
