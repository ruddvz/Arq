/**
 * ARQ-067: implement create element operation.
 *
 * The first concrete operation built on the ARQ-065 ModelOperation
 * contract: adds a new element to an element list. Pure and
 * store-agnostic - it takes the current element list and returns the
 * next one plus an OperationResult, rather than mutating anything or
 * talking to a real document/scene store (no such store exists in this
 * codebase yet - the same gap noted when ARQ-034/041/042 closed).
 *
 * Its inverse is a DeleteElement operation for the same id, matching
 * blueprint section 68's initial operations list (CreateWall/
 * CreateOpening/CreateRoom all pair with a DeleteElement/DeleteWall/etc
 * counterpart) and directly usable with undo-stack.ts's
 * {forward, inverse} pattern (ARQ-056/057).
 */

import type { ElementBase, ProjectId } from '@arq/bim-core';
import type {
  ModelOperation,
  OperationId,
  OperationPrecondition,
  OperationResult,
} from './operation';
import { rejectedResult } from './operation';

export interface CreateElementPayload<TElement extends ElementBase> {
  readonly element: TElement;
}

export interface DeleteElementPayload {
  readonly elementId: ElementBase['id'];
}

export interface BuildOperationParams {
  readonly id: OperationId;
  readonly actorId: string;
  readonly projectId: ProjectId;
  readonly baseRevision: number;
  readonly timestamp: string;
}

export function buildCreateElementOperation<TElement extends ElementBase>(
  params: BuildOperationParams & { readonly element: TElement },
  preconditions: readonly OperationPrecondition[] = [],
): ModelOperation<CreateElementPayload<TElement>> {
  return {
    id: params.id,
    type: 'CreateElement',
    actorId: params.actorId,
    projectId: params.projectId,
    baseRevision: params.baseRevision,
    timestamp: params.timestamp,
    payload: { element: params.element },
    preconditions,
  };
}

export function buildDeleteElementOperation(
  params: BuildOperationParams & { readonly elementId: ElementBase['id'] },
  preconditions: readonly OperationPrecondition[] = [],
): ModelOperation<DeleteElementPayload> {
  return {
    id: params.id,
    type: 'DeleteElement',
    actorId: params.actorId,
    projectId: params.projectId,
    baseRevision: params.baseRevision,
    timestamp: params.timestamp,
    payload: { elementId: params.elementId },
    preconditions,
  };
}

export interface ApplyResult<TElement extends ElementBase, TResult> {
  readonly elements: readonly TElement[];
  readonly result: OperationResult<TResult>;
}

/** Applies a CreateElement operation, rejecting (unchanged elements list) if the id already exists. */
export function applyCreateElement<TElement extends ElementBase>(
  elements: readonly TElement[],
  operation: ModelOperation<CreateElementPayload<TElement>>,
  inverseId: OperationId,
  durationMs: number,
): ApplyResult<TElement, TElement> {
  const { element } = operation.payload;
  if (elements.some((existing) => existing.id === element.id)) {
    return {
      elements,
      result: rejectedResult<TElement>(
        [
          {
            id: `${operation.id}-duplicate`,
            severity: 'error',
            code: 'DUPLICATE_ELEMENT_ID',
            title: 'Element already exists',
            explanation: `An element with id "${String(element.id)}" already exists.`,
            affectedElementIds: [element.id],
            suggestedActions: [],
          },
        ],
        durationMs,
      ),
    };
  }
  const inverse = buildDeleteElementOperation({
    id: inverseId,
    actorId: operation.actorId,
    projectId: operation.projectId,
    baseRevision: operation.baseRevision + 1,
    timestamp: operation.timestamp,
    elementId: element.id,
  });
  return {
    elements: [...elements, element],
    result: {
      status: 'applied',
      result: element,
      affectedElementIds: [element.id],
      invalidations: [],
      validationMessages: [],
      inverse,
      durationMs,
    },
  };
}

/** Applies a DeleteElement operation, rejecting (unchanged elements list) if the id doesn't exist. */
export function applyDeleteElement<TElement extends ElementBase>(
  elements: readonly TElement[],
  operation: ModelOperation<DeleteElementPayload>,
  inverseId: OperationId,
  durationMs: number,
): ApplyResult<TElement, TElement> {
  const { elementId } = operation.payload;
  const target = elements.find((existing) => existing.id === elementId);
  if (!target) {
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
  const inverse = buildCreateElementOperation({
    id: inverseId,
    actorId: operation.actorId,
    projectId: operation.projectId,
    baseRevision: operation.baseRevision + 1,
    timestamp: operation.timestamp,
    element: target,
  });
  return {
    elements: elements.filter((existing) => existing.id !== elementId),
    result: {
      status: 'applied',
      result: target,
      affectedElementIds: [elementId],
      invalidations: [],
      validationMessages: [],
      inverse,
      durationMs,
    },
  };
}
