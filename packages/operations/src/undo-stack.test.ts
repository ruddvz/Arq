import { describe, expect, it } from 'vitest';
import { createUndoStack, DEFAULT_UNDO_STACK_DEPTH } from './undo-stack';

describe('createUndoStack', () => {
  it('starts empty: neither undo nor redo is available', () => {
    const stack = createUndoStack<string>();
    expect(stack.canUndo()).toBe(false);
    expect(stack.canRedo()).toBe(false);
    expect(stack.undo()).toBeNull();
    expect(stack.redo()).toBeNull();
  });

  it('undo returns the inverse of the most recently pushed operation', () => {
    const stack = createUndoStack<string>();
    stack.push({ forward: 'add wall', inverse: 'remove wall' });
    expect(stack.canUndo()).toBe(true);
    expect(stack.undo()).toBe('remove wall');
    expect(stack.canUndo()).toBe(false);
  });

  it('redo returns the forward operation of the most recently undone entry', () => {
    const stack = createUndoStack<string>();
    stack.push({ forward: 'add wall', inverse: 'remove wall' });
    stack.undo();
    expect(stack.canRedo()).toBe(true);
    expect(stack.redo()).toBe('add wall');
    expect(stack.canRedo()).toBe(false);
  });

  it('undoes multiple operations in reverse (LIFO) order', () => {
    const stack = createUndoStack<string>();
    stack.push({ forward: 'add wall', inverse: 'remove wall' });
    stack.push({ forward: 'add door', inverse: 'remove door' });
    expect(stack.undo()).toBe('remove door');
    expect(stack.undo()).toBe('remove wall');
    expect(stack.undo()).toBeNull();
  });

  it('pushing a new operation after an undo clears the redo stack', () => {
    const stack = createUndoStack<string>();
    stack.push({ forward: 'add wall', inverse: 'remove wall' });
    stack.undo();
    expect(stack.canRedo()).toBe(true);
    stack.push({ forward: 'add door', inverse: 'remove door' });
    expect(stack.canRedo()).toBe(false);
    expect(stack.redo()).toBeNull();
  });

  it('drops the oldest entry once maxDepth is exceeded', () => {
    const stack = createUndoStack<string>(2);
    stack.push({ forward: 'op1', inverse: 'undo1' });
    stack.push({ forward: 'op2', inverse: 'undo2' });
    stack.push({ forward: 'op3', inverse: 'undo3' });
    expect(stack.undo()).toBe('undo3');
    expect(stack.undo()).toBe('undo2');
    expect(stack.undo()).toBeNull(); // op1 was evicted
  });

  it('clear() empties both stacks', () => {
    const stack = createUndoStack<string>();
    stack.push({ forward: 'add wall', inverse: 'remove wall' });
    stack.undo();
    stack.clear();
    expect(stack.canUndo()).toBe(false);
    expect(stack.canRedo()).toBe(false);
  });

  it('defaults to DEFAULT_UNDO_STACK_DEPTH when no maxDepth is given', () => {
    const stack = createUndoStack<number>();
    for (let i = 0; i < DEFAULT_UNDO_STACK_DEPTH; i += 1) {
      stack.push({ forward: i, inverse: -i });
    }
    // one more than the default depth should evict the oldest (index 0).
    stack.push({ forward: DEFAULT_UNDO_STACK_DEPTH, inverse: -DEFAULT_UNDO_STACK_DEPTH });
    for (let i = 0; i < DEFAULT_UNDO_STACK_DEPTH; i += 1) {
      stack.undo();
    }
    expect(stack.canUndo()).toBe(false);
  });
});
