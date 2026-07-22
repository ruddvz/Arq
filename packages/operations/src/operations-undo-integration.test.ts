import { describe, expect, it } from 'vitest';
import { elementId, projectId, type ElementBase } from '@arq/bim-core';
import { createUndoStack } from './undo-stack';
import { operationId, type ModelOperation } from './operation';
import {
  applyCreateElement,
  applyDeleteElement,
  buildCreateElementOperation,
} from './create-element-operation';
import { applyUpdateProperty, buildUpdatePropertyOperation } from './update-property-operation';

/**
 * Ties ARQ-056/057 (undo stack), ARQ-065 (operation contract), and
 * ARQ-067/068 (create/update operations) together end to end: apply a
 * sequence of real operations, push each (forward, inverse) pair onto
 * the undo stack, then undo back to the start and verify the element
 * list is byte-for-byte the same as before anything was applied.
 */

interface TestElement extends ElementBase {
  readonly name: string;
  readonly width: number;
}

const params = {
  actorId: 'user-1',
  projectId: projectId('p1'),
  baseRevision: 0,
  timestamp: '2026-07-22T00:00:00.000Z',
};

type AnyOperation = ModelOperation;

function applyAny(
  elements: readonly TestElement[],
  operation: AnyOperation,
): readonly TestElement[] {
  if (operation.type === 'CreateElement') {
    return applyCreateElement<TestElement>(
      elements,
      operation as ReturnType<typeof buildCreateElementOperation<TestElement>>,
      operationId(`${operation.id}-inv`),
      1,
    ).elements;
  }
  if (operation.type === 'DeleteElement') {
    return applyDeleteElement<TestElement>(
      elements,
      operation as Parameters<typeof applyDeleteElement<TestElement>>[1],
      operationId(`${operation.id}-inv`),
      1,
    ).elements;
  }
  if (operation.type === 'UpdateProperty') {
    return applyUpdateProperty<TestElement, 'width'>(
      elements,
      operation as ReturnType<typeof buildUpdatePropertyOperation<TestElement, 'width'>>,
      operationId(`${operation.id}-inv`),
      1,
    ).elements;
  }
  throw new Error(`unhandled operation type: ${operation.type}`);
}

describe('operations + undo stack integration', () => {
  it('creating an element then updating its width can be fully undone back to the empty starting state', () => {
    const stack = createUndoStack<AnyOperation>();
    let elements: readonly TestElement[] = [];

    const element: TestElement = { id: elementId('e1'), name: 'Wall A', width: 200 };
    const createOp = buildCreateElementOperation({ id: operationId('op-1'), ...params, element });
    const created = applyCreateElement<TestElement>(elements, createOp, operationId('op-1-inv'), 1);
    elements = created.elements;
    stack.push({ forward: createOp, inverse: created.result.inverse! });

    const updateOp = buildUpdatePropertyOperation<TestElement, 'width'>({
      id: operationId('op-2'),
      ...params,
      elementId: element.id,
      propertyKey: 'width',
      newValue: 300,
    });
    const updated = applyUpdateProperty<TestElement, 'width'>(
      elements,
      updateOp,
      operationId('op-2-inv'),
      1,
    );
    elements = updated.elements;
    stack.push({ forward: updateOp, inverse: updated.result.inverse! });

    expect(elements).toEqual([{ id: 'e1', name: 'Wall A', width: 300 }]);

    // undo the width update
    const undoUpdate = stack.undo();
    expect(undoUpdate).not.toBeNull();
    elements = applyAny(elements, undoUpdate!);
    expect(elements[0]?.width).toBe(200);

    // undo the creation itself
    const undoCreate = stack.undo();
    expect(undoCreate).not.toBeNull();
    elements = applyAny(elements, undoCreate!);
    expect(elements).toEqual([]);
    expect(stack.canUndo()).toBe(false);

    // redo both steps and land back where we started
    elements = applyAny(elements, stack.redo()!);
    elements = applyAny(elements, stack.redo()!);
    expect(elements).toEqual([{ id: 'e1', name: 'Wall A', width: 300 }]);
    expect(stack.canRedo()).toBe(false);
  });
});
