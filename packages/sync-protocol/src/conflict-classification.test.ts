import { describe, expect, it } from 'vitest';
import { classifyConflict, type TouchedEntities } from './conflict-classification';

function touched(writes: readonly string[] = [], deletes: readonly string[] = []): TouchedEntities {
  return { writes: new Set(writes), deletes: new Set(deletes) };
}

describe('classifyConflict', () => {
  it('is no-conflict when the two operations touch entirely disjoint entities', () => {
    expect(classifyConflict(touched(['wall-1']), touched(['wall-2']))).toBe('no-conflict');
  });

  it('is concurrent-write when both operations wrote the same entity', () => {
    expect(classifyConflict(touched(['wall-1']), touched(['wall-1']))).toBe('concurrent-write');
  });

  it('is write-after-delete when one operation deleted an entity the other wrote to', () => {
    expect(classifyConflict(touched([], ['wall-1']), touched(['wall-1']))).toBe(
      'write-after-delete',
    );
    // Symmetric - argument order must not change the classification.
    expect(classifyConflict(touched(['wall-1']), touched([], ['wall-1']))).toBe(
      'write-after-delete',
    );
  });

  it('is write-after-delete (not merely concurrent-write) when both deleted the same entity', () => {
    expect(classifyConflict(touched([], ['wall-1']), touched([], ['wall-1']))).toBe(
      'write-after-delete',
    );
  });

  it('is no-conflict when operations touch different entities even with overlapping writes and deletes elsewhere', () => {
    expect(classifyConflict(touched(['wall-1'], ['wall-2']), touched(['wall-3']))).toBe(
      'no-conflict',
    );
  });

  it('classifies an operation touching multiple entities against one touching only one of them', () => {
    expect(classifyConflict(touched(['wall-1', 'wall-2']), touched(['wall-2']))).toBe(
      'concurrent-write',
    );
  });
});
