import { describe, expect, it } from 'vitest';
import {
  commitOperation,
  boundInvalidations,
  OPERATION_REJECTION_CODES,
  type CommitOperationInput,
} from './operation-pipeline';
import { operationId, type ModelOperation, type OperationResult } from './operation';
import type { ElementId, ProjectId } from '@arq/bim-core';
import type { ValidationMessage } from './validation-result';

interface TestState {
  readonly elements: readonly string[];
}

function op(overrides: Partial<ModelOperation> = {}): ModelOperation {
  return {
    id: operationId('op-1'),
    type: 'CreateElement',
    actorId: 'user-1',
    projectId: 'project-1' as ProjectId,
    baseRevision: 7,
    timestamp: '2026-08-05T00:00:00.000Z',
    payload: {},
    preconditions: [],
    ...overrides,
  };
}

function appliedResult(overrides: Partial<OperationResult> = {}): OperationResult {
  return {
    status: 'applied',
    affectedElementIds: ['w1' as ElementId],
    invalidations: [],
    validationMessages: [],
    durationMs: 1,
    ...overrides,
  };
}

function error(id: string): ValidationMessage {
  return {
    id,
    severity: 'error',
    code: 'ARQ_TEST_INVALID',
    title: 'Invalid',
    explanation: 'not allowed',
    affectedElementIds: [],
    suggestedActions: [],
  };
}

function warning(id: string): ValidationMessage {
  return { ...error(id), severity: 'warning' };
}

/** A working pipeline whose individual steps each test overrides as needed. */
function input(
  overrides: Partial<CommitOperationInput<TestState>> = {},
): CommitOperationInput<TestState> {
  return {
    state: { elements: ['w1'] },
    operation: op(),
    currentRevision: 7,
    writable: true,
    source: 'user',
    apply: (state) => ({
      status: 'applied',
      state: { elements: [...state.elements, 'w2'] },
      result: appliedResult(),
    }),
    commit: () => ({ status: 'committed', revision: 8 }),
    ...overrides,
  };
}

describe('commitOperation', () => {
  it('commits a valid operation and reports the revision the store confirmed', () => {
    const outcome = commitOperation(input());

    expect(outcome.status).toBe('committed');
    if (outcome.status !== 'committed') return;
    expect(outcome.revision).toBe(8);
    expect(outcome.state.elements).toEqual(['w1', 'w2']);
  });

  it('records provenance for every commit', () => {
    const outcome = commitOperation(input({ source: 'ai' }));

    expect(outcome.status).toBe('committed');
    if (outcome.status !== 'committed') return;
    expect(outcome.provenance).toEqual({
      operationId: 'op-1',
      operationType: 'CreateElement',
      actorId: 'user-1',
      source: 'ai',
      baseRevision: 7,
      committedRevision: 8,
      timestamp: '2026-08-05T00:00:00.000Z',
    });
  });

  it('refuses to write into a read-only project', () => {
    const outcome = commitOperation(input({ writable: false }));

    expect(outcome).toMatchObject({
      status: 'rejected',
      code: OPERATION_REJECTION_CODES.notWritable,
      revision: 7,
    });
  });

  /**
   * V3-056. An operation built on a revision the store has moved past was
   * validated against state that no longer exists.
   */
  it('rejects an operation built on a revision the project has moved past', () => {
    const outcome = commitOperation(input({ operation: op({ baseRevision: 5 }) }));

    expect(outcome).toMatchObject({
      status: 'rejected',
      code: OPERATION_REJECTION_CODES.staleBaseRevision,
    });
    if (outcome.status !== 'rejected') return;
    expect(outcome.detail).toContain('5');
    expect(outcome.detail).toContain('7');
  });

  it('rejects an operation built on a revision ahead of the project', () => {
    const outcome = commitOperation(input({ operation: op({ baseRevision: 9 }) }));

    expect(outcome).toMatchObject({
      status: 'rejected',
      code: OPERATION_REJECTION_CODES.staleBaseRevision,
    });
  });

  it('checks declared preconditions against current state before applying', () => {
    let applied = false;
    const outcome = commitOperation(
      input({
        operation: op({ preconditions: [{ kind: 'element-exists', payload: { id: 'w9' } }] }),
        checkPrecondition: () => false,
        apply: () => {
          applied = true;
          throw new Error('should not be reached');
        },
      }),
    );

    expect(outcome).toMatchObject({
      status: 'rejected',
      code: OPERATION_REJECTION_CODES.preconditionFailed,
    });
    expect(applied).toBe(false);
  });

  it('validates the candidate state, not the inputs', () => {
    const seen: TestState[] = [];
    commitOperation(
      input({
        validate: (candidate) => {
          seen.push(candidate);
          return [];
        },
      }),
    );

    // The state validation saw is the one the operation produced.
    expect(seen).toEqual([{ elements: ['w1', 'w2'] }]);
  });

  it('rejects when the resulting project would carry a validation error', () => {
    const outcome = commitOperation(input({ validate: () => [error('v1')] }));

    expect(outcome).toMatchObject({
      status: 'rejected',
      code: OPERATION_REJECTION_CODES.validationFailed,
    });
  });

  it('commits despite warnings, since a blocking warning would just be an error', () => {
    const outcome = commitOperation(input({ validate: () => [warning('v1')] }));

    expect(outcome.status).toBe('committed');
    if (outcome.status !== 'committed') return;
    expect(outcome.validationMessages).toHaveLength(1);
  });

  it('never runs the commit when validation failed', () => {
    let committed = false;
    commitOperation(
      input({
        validate: () => [error('v1')],
        commit: () => {
          committed = true;
          return { status: 'committed', revision: 8 };
        },
      }),
    );

    expect(committed).toBe(false);
  });

  it('reports a rejected commit rather than adopting the candidate', () => {
    const outcome = commitOperation(
      input({ commit: () => ({ status: 'rejected', reason: 'disk full' }) }),
    );

    expect(outcome).toMatchObject({
      status: 'rejected',
      code: OPERATION_REJECTION_CODES.commitFailed,
      detail: 'disk full',
    });
  });

  it('treats a throwing commit as a rejection rather than letting it escape', () => {
    const outcome = commitOperation(
      input({
        commit: () => {
          throw new Error('transaction aborted');
        },
      }),
    );

    expect(outcome).toMatchObject({
      status: 'rejected',
      code: OPERATION_REJECTION_CODES.commitFailed,
      detail: 'transaction aborted',
    });
  });

  it('treats a throwing operation as a rejection', () => {
    const outcome = commitOperation(
      input({
        apply: () => {
          throw new Error('bad payload');
        },
      }),
    );

    expect(outcome).toMatchObject({
      status: 'rejected',
      code: OPERATION_REJECTION_CODES.applyRejected,
      detail: 'bad payload',
    });
  });

  /**
   * V3-052 checked rather than trusted: a store reporting a revision that did
   * not move has not committed what it was handed, and adopting the candidate
   * would make memory and the canonical store disagree silently.
   */
  it('rejects a commit whose reported revision did not advance', () => {
    const outcome = commitOperation(
      input({ commit: () => ({ status: 'committed', revision: 7 }) }),
    );

    expect(outcome).toMatchObject({
      status: 'rejected',
      code: OPERATION_REJECTION_CODES.revisionInvariant,
    });
  });

  it('rejects a commit whose reported revision went backwards', () => {
    const outcome = commitOperation(
      input({ commit: () => ({ status: 'committed', revision: 3 }) }),
    );

    expect(outcome).toMatchObject({
      status: 'rejected',
      code: OPERATION_REJECTION_CODES.revisionInvariant,
    });
  });

  /**
   * The invariant the whole module exists for: an invalid operation leaves
   * committed state and revision unchanged. Asserted for every rejection path,
   * because one path forgetting it is all it takes.
   */
  it.each([
    ['not writable', input({ writable: false })],
    ['stale', input({ operation: op({ baseRevision: 5 }) })],
    [
      'precondition',
      input({
        operation: op({ preconditions: [{ kind: 'k', payload: {} }] }),
        checkPrecondition: () => false,
      }),
    ],
    ['validation', input({ validate: () => [error('v1')] })],
    ['commit rejected', input({ commit: () => ({ status: 'rejected', reason: 'no' }) })],
    ['revision invariant', input({ commit: () => ({ status: 'committed', revision: 7 }) })],
  ])('leaves state and revision unchanged when rejected (%s)', (_name, testInput) => {
    const before = testInput.state;
    const outcome = commitOperation(testInput);

    expect(outcome.status).toBe('rejected');
    if (outcome.status !== 'rejected') return;
    expect(outcome.state).toBe(before);
    expect(outcome.state.elements).toEqual(['w1']);
    expect(outcome.revision).toBe(7);
  });
});

describe('boundInvalidations', () => {
  /**
   * V3-057. An operation claiming to invalidate elements it never touched
   * causes retessellation and re-render for elements that did not change.
   */
  it('drops invalidations for elements the operation did not affect', () => {
    const bounded = boundInvalidations(
      appliedResult({
        affectedElementIds: ['w1' as ElementId],
        invalidations: [{ kind: 'mesh', elementIds: ['w1', 'w2'] as ElementId[] }],
      }),
    );

    expect(bounded).toEqual([{ kind: 'mesh', elementIds: ['w1'] }]);
  });

  it('drops an invalidation entirely when none of its elements were affected', () => {
    const bounded = boundInvalidations(
      appliedResult({
        affectedElementIds: ['w1' as ElementId],
        invalidations: [{ kind: 'mesh', elementIds: ['w9'] as ElementId[] }],
      }),
    );

    expect(bounded).toEqual([]);
  });

  it('keeps invalidations that stay within the affected set', () => {
    const bounded = boundInvalidations(
      appliedResult({
        affectedElementIds: ['w1', 'w2'] as ElementId[],
        invalidations: [
          { kind: 'mesh', elementIds: ['w1'] as ElementId[] },
          { kind: 'room-area', elementIds: ['w2'] as ElementId[] },
        ],
      }),
    );

    expect(bounded).toHaveLength(2);
  });

  it('narrows rather than widens, so nothing outside the affected set survives', () => {
    const bounded = boundInvalidations(
      appliedResult({
        affectedElementIds: [],
        invalidations: [{ kind: 'mesh', elementIds: ['w1', 'w2'] as ElementId[] }],
      }),
    );

    expect(bounded).toEqual([]);
  });
});
