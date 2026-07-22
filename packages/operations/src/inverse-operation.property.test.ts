import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { elementId, projectId, type ElementBase } from '@arq/bim-core';
import { operationId } from './operation';
import {
  applyCreateElement,
  applyDeleteElement,
  buildCreateElementOperation,
} from './create-element-operation';
import { applyUpdateProperty, buildUpdatePropertyOperation } from './update-property-operation';

/**
 * ARQ-070: implement inverse operation tests.
 *
 * The example-based tests in create-element-operation.test.ts and
 * update-property-operation.test.ts each check one hand-picked
 * before/after pair. These property-based tests generalize that: for
 * *any* generated element/value, applying an operation and then its own
 * generated inverse must return to the exact starting element list -
 * this is the actual invariant blueprint section 69's "every committed
 * user edit declares inverse behaviour" depends on, not just true for
 * the specific examples above.
 */

interface TestElement extends ElementBase {
  readonly width: number;
}

const baseParams = {
  actorId: 'user-1',
  projectId: projectId('p1'),
  baseRevision: 0,
  timestamp: '2026-07-22T00:00:00.000Z',
};

describe('CreateElement / DeleteElement inverse property', () => {
  it('applying create then its inverse always returns to the original element list', () => {
    fc.assert(
      fc.property(
        fc.array(fc.string({ minLength: 1, maxLength: 8 }), { maxLength: 5 }),
        fc.string({ minLength: 1, maxLength: 8 }),
        fc.integer({ min: 0, max: 100000 }),
        (existingIds, newId, width) => {
          fc.pre(!existingIds.includes(newId));
          const startingElements: readonly TestElement[] = existingIds.map((id) => ({
            id: elementId(id),
            width: 0,
          }));
          const newElement: TestElement = { id: elementId(newId), width };
          const createOp = buildCreateElementOperation({
            id: operationId('op-create'),
            ...baseParams,
            element: newElement,
          });
          const created = applyCreateElement<TestElement>(
            startingElements,
            createOp,
            operationId('op-create-inv'),
            0,
          );
          expect(created.result.status).toBe('applied');
          const undone = applyDeleteElement<TestElement>(
            created.elements,
            created.result.inverse as Parameters<typeof applyDeleteElement<TestElement>>[1],
            operationId('op-create-inv-inv'),
            0,
          );
          expect(undone.elements).toEqual(startingElements);
        },
      ),
    );
  });
});

describe('UpdateProperty inverse property', () => {
  it('applying an update then its inverse always restores the original property value', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 8 }),
        fc.integer({ min: 0, max: 100000 }),
        fc.integer({ min: 0, max: 100000 }),
        (id, oldWidth, newWidth) => {
          const element: TestElement = { id: elementId(id), width: oldWidth };
          const updateOp = buildUpdatePropertyOperation<TestElement, 'width'>({
            id: operationId('op-update'),
            ...baseParams,
            elementId: element.id,
            propertyKey: 'width',
            newValue: newWidth,
          });
          const updated = applyUpdateProperty<TestElement, 'width'>(
            [element],
            updateOp,
            operationId('op-update-inv'),
            0,
          );
          expect(updated.elements[0]?.width).toBe(newWidth);
          const reverted = applyUpdateProperty<TestElement, 'width'>(
            updated.elements,
            updated.result.inverse as Parameters<
              typeof applyUpdateProperty<TestElement, 'width'>
            >[1],
            operationId('op-update-inv-inv'),
            0,
          );
          expect(reverted.elements).toEqual([element]);
        },
      ),
    );
  });
});
