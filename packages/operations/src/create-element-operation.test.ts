import { describe, expect, it } from 'vitest';
import { elementId, projectId, type ElementBase } from '@arq/bim-core';
import { operationId } from './operation';
import {
  applyCreateElement,
  applyDeleteElement,
  buildCreateElementOperation,
  buildDeleteElementOperation,
} from './create-element-operation';

interface TestElement extends ElementBase {
  readonly name: string;
}

const params = {
  actorId: 'user-1',
  projectId: projectId('p1'),
  baseRevision: 0,
  timestamp: '2026-07-22T00:00:00.000Z',
};

describe('applyCreateElement', () => {
  it('appends the new element and returns an applied result with a DeleteElement inverse', () => {
    const element: TestElement = { id: elementId('e1'), name: 'Wall A' };
    const operation = buildCreateElementOperation({ id: operationId('op-1'), ...params, element });
    const { elements, result } = applyCreateElement<TestElement>(
      [],
      operation,
      operationId('op-1-inv'),
      3,
    );
    expect(elements).toEqual([element]);
    expect(result.status).toBe('applied');
    expect(result.affectedElementIds).toEqual([element.id]);
    expect(result.inverse?.type).toBe('DeleteElement');
    expect(result.durationMs).toBe(3);
  });

  it('rejects (leaving elements unchanged) when the id already exists', () => {
    const element: TestElement = { id: elementId('e1'), name: 'Wall A' };
    const operation = buildCreateElementOperation({ id: operationId('op-1'), ...params, element });
    const { elements, result } = applyCreateElement<TestElement>(
      [element],
      operation,
      operationId('op-1-inv'),
      1,
    );
    expect(elements).toEqual([element]);
    expect(result.status).toBe('rejected');
    expect(result.validationMessages[0]?.code).toBe('DUPLICATE_ELEMENT_ID');
  });
});

describe('applyDeleteElement', () => {
  it('removes the element and returns an applied result with a CreateElement inverse', () => {
    const element: TestElement = { id: elementId('e1'), name: 'Wall A' };
    const operation = buildDeleteElementOperation({
      id: operationId('op-2'),
      ...params,
      elementId: element.id,
    });
    const { elements, result } = applyDeleteElement<TestElement>(
      [element],
      operation,
      operationId('op-2-inv'),
      2,
    );
    expect(elements).toEqual([]);
    expect(result.status).toBe('applied');
    expect(result.inverse?.type).toBe('CreateElement');
  });

  it('rejects (leaving elements unchanged) when the id does not exist', () => {
    const operation = buildDeleteElementOperation({
      id: operationId('op-2'),
      ...params,
      elementId: elementId('missing'),
    });
    const { elements, result } = applyDeleteElement<TestElement>(
      [],
      operation,
      operationId('op-2-inv'),
      1,
    );
    expect(elements).toEqual([]);
    expect(result.status).toBe('rejected');
    expect(result.validationMessages[0]?.code).toBe('ELEMENT_NOT_FOUND');
  });
});

describe('create/delete round trip', () => {
  it('applying create then its own inverse (delete) returns to the original elements', () => {
    const element: TestElement = { id: elementId('e1'), name: 'Wall A' };
    const createOp = buildCreateElementOperation({ id: operationId('op-1'), ...params, element });
    const created = applyCreateElement<TestElement>([], createOp, operationId('op-1-inv'), 1);
    expect(created.result.inverse).toBeDefined();
    const deleted = applyDeleteElement<TestElement>(
      created.elements,
      created.result.inverse as ReturnType<typeof buildDeleteElementOperation>,
      operationId('op-1-inv-inv'),
      1,
    );
    expect(deleted.elements).toEqual([]);
  });
});
