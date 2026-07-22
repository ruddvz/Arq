import { describe, expect, it } from 'vitest';
import { projectId } from '@arq/bim-core';
import { operationId, rejectedResult, type ModelOperation } from './operation';

describe('operationId', () => {
  it('returns the underlying string value unchanged at runtime', () => {
    expect(operationId('op-1')).toBe('op-1');
  });
});

describe('rejectedResult', () => {
  it('builds a rejected OperationResult carrying the given validation messages and no inverse', () => {
    const result = rejectedResult(
      [
        {
          id: 'm1',
          severity: 'error',
          code: 'DUPLICATE_ID',
          title: 'Duplicate element id',
          explanation: 'An element with this id already exists.',
          affectedElementIds: [],
          suggestedActions: [],
        },
      ],
      5,
    );
    expect(result.status).toBe('rejected');
    expect(result.affectedElementIds).toEqual([]);
    expect(result.invalidations).toEqual([]);
    expect(result.inverse).toBeUndefined();
    expect(result.durationMs).toBe(5);
    expect(result.validationMessages).toHaveLength(1);
  });
});

describe('ModelOperation shape', () => {
  it('accepts a well-formed operation matching the blueprint section 67 contract', () => {
    const operation: ModelOperation<{ readonly note: string }> = {
      id: operationId('op-1'),
      type: 'Noop',
      actorId: 'user-1',
      projectId: projectId('p1'),
      baseRevision: 0,
      timestamp: '2026-07-22T00:00:00.000Z',
      payload: { note: 'example' },
      preconditions: [],
    };
    expect(operation.type).toBe('Noop');
  });
});
