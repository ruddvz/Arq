import { describe, expect, it } from 'vitest';
import { elementId, projectId } from '@arq/bim-core';
import { buildHistoryPropertyGroup, type AppliedOperationLogEntry } from './history-property-group';
import type { ModelOperation, OperationResult } from './operation';
import { operationId } from './operation';

const wall1 = elementId('wall-1');
const wall2 = elementId('wall-2');

function operation(
  overrides: Partial<ModelOperation> & Pick<ModelOperation, 'id'>,
): ModelOperation {
  return {
    type: 'UPDATE_PROPERTY',
    actorId: 'user-1',
    projectId: projectId('project-1'),
    baseRevision: 0,
    timestamp: '2026-01-01T00:00:00.000Z',
    payload: {},
    preconditions: [],
    ...overrides,
  };
}

function appliedResult(overrides: Partial<OperationResult> = {}): OperationResult {
  return {
    status: 'applied',
    affectedElementIds: [wall1],
    invalidations: [],
    validationMessages: [],
    durationMs: 1,
    ...overrides,
  };
}

describe('buildHistoryPropertyGroup', () => {
  it('keeps only entries whose result affected the given element', () => {
    const forWall1: AppliedOperationLogEntry = {
      operation: operation({ id: operationId('op-1') }),
      result: appliedResult({ affectedElementIds: [wall1] }),
    };
    const forWall2: AppliedOperationLogEntry = {
      operation: operation({ id: operationId('op-2') }),
      result: appliedResult({ affectedElementIds: [wall2] }),
    };
    const group = buildHistoryPropertyGroup(wall1, [forWall1, forWall2]);
    expect(group.entries).toEqual([
      {
        operationId: 'op-1',
        type: 'UPDATE_PROPERTY',
        actorId: 'user-1',
        timestamp: '2026-01-01T00:00:00.000Z',
      },
    ]);
  });

  it('excludes rejected operations even if they name the element', () => {
    const rejected: AppliedOperationLogEntry = {
      operation: operation({ id: operationId('op-1') }),
      result: appliedResult({ status: 'rejected', affectedElementIds: [wall1] }),
    };
    expect(buildHistoryPropertyGroup(wall1, [rejected]).entries).toEqual([]);
  });

  it('returns an empty group when no log entries affected the element', () => {
    const forWall2: AppliedOperationLogEntry = {
      operation: operation({ id: operationId('op-1') }),
      result: appliedResult({ affectedElementIds: [wall2] }),
    };
    expect(buildHistoryPropertyGroup(wall1, [forWall2]).entries).toEqual([]);
  });

  it('orders entries most-recent-first', () => {
    const older: AppliedOperationLogEntry = {
      operation: operation({ id: operationId('op-1'), timestamp: '2026-01-01T00:00:00.000Z' }),
      result: appliedResult(),
    };
    const newer: AppliedOperationLogEntry = {
      operation: operation({ id: operationId('op-2'), timestamp: '2026-01-02T00:00:00.000Z' }),
      result: appliedResult(),
    };
    const group = buildHistoryPropertyGroup(wall1, [older, newer]);
    expect(group.entries.map((entry) => entry.operationId)).toEqual(['op-2', 'op-1']);
  });

  it('keeps the log order for entries sharing the same timestamp (stable sort)', () => {
    const first: AppliedOperationLogEntry = {
      operation: operation({ id: operationId('op-1') }),
      result: appliedResult(),
    };
    const second: AppliedOperationLogEntry = {
      operation: operation({ id: operationId('op-2') }),
      result: appliedResult(),
    };
    const group = buildHistoryPropertyGroup(wall1, [first, second]);
    expect(group.entries.map((entry) => entry.operationId)).toEqual(['op-1', 'op-2']);
  });
});
