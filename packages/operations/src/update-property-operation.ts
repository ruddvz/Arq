/**
 * ARQ-068: implement update property operation.
 *
 * Changes a single property on an existing element. Same pure,
 * store-agnostic shape as create-element-operation.ts (ARQ-067): takes
 * the current element list and returns the next one plus an
 * OperationResult, no real document/scene store involved.
 *
 * Its inverse is another UpdateProperty operation for the same element
 * and property, restoring the property's *previous* value - not a
 * generic "undo everything" operation, so undoing a chain of unrelated
 * property edits on the same element only reverts one property at a
 * time, matching blueprint section 69's "every committed user edit
 * declares inverse behaviour."
 */

import type { ElementBase, ProjectId } from '@arq/bim-core';
import type {
  ModelOperation,
  OperationId,
  OperationPrecondition,
  OperationResult,
} from './operation';
import { rejectedResult } from './operation';

export interface UpdatePropertyPayload<TElement extends ElementBase, K extends keyof TElement> {
  readonly elementId: TElement['id'];
  readonly propertyKey: K;
  readonly newValue: TElement[K];
}

export interface BuildUpdatePropertyParams<TElement extends ElementBase, K extends keyof TElement> {
  readonly id: OperationId;
  readonly actorId: string;
  readonly projectId: ProjectId;
  readonly baseRevision: number;
  readonly timestamp: string;
  readonly elementId: TElement['id'];
  readonly propertyKey: K;
  readonly newValue: TElement[K];
}

export function buildUpdatePropertyOperation<
  TElement extends ElementBase,
  K extends keyof TElement,
>(
  params: BuildUpdatePropertyParams<TElement, K>,
  preconditions: readonly OperationPrecondition[] = [],
): ModelOperation<UpdatePropertyPayload<TElement, K>> {
  return {
    id: params.id,
    type: 'UpdateProperty',
    actorId: params.actorId,
    projectId: params.projectId,
    baseRevision: params.baseRevision,
    timestamp: params.timestamp,
    payload: {
      elementId: params.elementId,
      propertyKey: params.propertyKey,
      newValue: params.newValue,
    },
    preconditions,
  };
}

export interface ApplyUpdatePropertyResult<TElement extends ElementBase> {
  readonly elements: readonly TElement[];
  readonly result: OperationResult<TElement>;
}

export function applyUpdateProperty<TElement extends ElementBase, K extends keyof TElement>(
  elements: readonly TElement[],
  operation: ModelOperation<UpdatePropertyPayload<TElement, K>>,
  inverseId: OperationId,
  durationMs: number,
): ApplyUpdatePropertyResult<TElement> {
  const { elementId, propertyKey, newValue } = operation.payload;
  const index = elements.findIndex((existing) => existing.id === elementId);
  if (index === -1) {
    return {
      elements,
      result: rejectedResult<TElement>(
        [
          {
            id: `${operation.id}-missing`,
            severity: 'error',
            code: 'ELEMENT_NOT_FOUND',
            title: 'Element not found',
            explanation: `No element with id "${String(elementId)}" exists.`,
            affectedElementIds: [],
            suggestedActions: [],
          },
        ],
        durationMs,
      ),
    };
  }
  const target = elements[index]!;
  const previousValue = target[propertyKey];
  const updated: TElement = { ...target, [propertyKey]: newValue };
  const nextElements = [...elements.slice(0, index), updated, ...elements.slice(index + 1)];
  const inverse = buildUpdatePropertyOperation<TElement, K>({
    id: inverseId,
    actorId: operation.actorId,
    projectId: operation.projectId,
    baseRevision: operation.baseRevision + 1,
    timestamp: operation.timestamp,
    elementId,
    propertyKey,
    newValue: previousValue,
  });
  return {
    elements: nextElements,
    result: {
      status: 'applied',
      result: updated,
      affectedElementIds: [elementId],
      invalidations: [],
      validationMessages: [],
      inverse,
      durationMs,
    },
  };
}
