import { describe, expect, it } from 'vitest';
import { elementId, projectId, type ElementBase } from '@arq/bim-core';
import { operationId } from './operation';
import { applyUpdateProperty, buildUpdatePropertyOperation } from './update-property-operation';

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

describe('applyUpdateProperty', () => {
  it('updates the target property and returns an applied result with the previous value as the inverse', () => {
    const element: TestElement = { id: elementId('e1'), name: 'Wall A', width: 200 };
    const operation = buildUpdatePropertyOperation<TestElement, 'width'>({
      id: operationId('op-1'),
      ...params,
      elementId: element.id,
      propertyKey: 'width',
      newValue: 300,
    });
    const { elements, result } = applyUpdateProperty<TestElement, 'width'>(
      [element],
      operation,
      operationId('op-1-inv'),
      2,
    );
    expect(elements[0]?.width).toBe(300);
    expect(result.status).toBe('applied');
    expect(result.inverse?.type).toBe('UpdateProperty');
    expect((result.inverse?.payload as { newValue: number }).newValue).toBe(200);
  });

  it('does not touch other elements or other properties', () => {
    const target: TestElement = { id: elementId('e1'), name: 'Wall A', width: 200 };
    const other: TestElement = { id: elementId('e2'), name: 'Wall B', width: 150 };
    const operation = buildUpdatePropertyOperation<TestElement, 'width'>({
      id: operationId('op-1'),
      ...params,
      elementId: target.id,
      propertyKey: 'width',
      newValue: 300,
    });
    const { elements } = applyUpdateProperty<TestElement, 'width'>(
      [target, other],
      operation,
      operationId('inv'),
      1,
    );
    expect(elements[0]?.name).toBe('Wall A');
    expect(elements[1]).toEqual(other);
  });

  it('rejects (leaving elements unchanged) when the element does not exist', () => {
    const operation = buildUpdatePropertyOperation<TestElement, 'width'>({
      id: operationId('op-1'),
      ...params,
      elementId: elementId('missing'),
      propertyKey: 'width',
      newValue: 300,
    });
    const { elements, result } = applyUpdateProperty<TestElement, 'width'>(
      [],
      operation,
      operationId('inv'),
      1,
    );
    expect(elements).toEqual([]);
    expect(result.status).toBe('rejected');
    expect(result.validationMessages[0]?.code).toBe('ELEMENT_NOT_FOUND');
  });

  it('applying the inverse restores the original value', () => {
    const element: TestElement = { id: elementId('e1'), name: 'Wall A', width: 200 };
    const operation = buildUpdatePropertyOperation<TestElement, 'width'>({
      id: operationId('op-1'),
      ...params,
      elementId: element.id,
      propertyKey: 'width',
      newValue: 300,
    });
    const updated = applyUpdateProperty<TestElement, 'width'>(
      [element],
      operation,
      operationId('inv'),
      1,
    );
    const inverseOp = updated.result.inverse as ReturnType<
      typeof buildUpdatePropertyOperation<TestElement, 'width'>
    >;
    const reverted = applyUpdateProperty<TestElement, 'width'>(
      updated.elements,
      inverseOp,
      operationId('inv-inv'),
      1,
    );
    expect(reverted.elements[0]?.width).toBe(200);
  });
});
