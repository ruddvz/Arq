import { describe, expect, it } from 'vitest';
import { createInvalidationPlan } from './invalidation';
import type { InvalidationTarget } from './types';

describe('createInvalidationPlan', () => {
  it('collapses duplicate (outputKind, scopeId) targets, keeping the higher-priority one', () => {
    const targets: readonly InvalidationTarget[] = [
      { outputKind: 'thumbnail', scopeId: 's1', priority: 'ExportOnly', reason: 'low' },
      { outputKind: 'thumbnail', scopeId: 's1', priority: 'InteractiveCritical', reason: 'high' },
    ];
    const plan = createInvalidationPlan(targets);
    expect(plan).toHaveLength(1);
    expect(plan[0]?.priority).toBe('InteractiveCritical');
    expect(plan[0]?.reason).toBe('high');
  });

  it('does not collapse targets with different scopeId or outputKind', () => {
    const targets: readonly InvalidationTarget[] = [
      { outputKind: 'thumbnail', scopeId: 's1', priority: 'ActiveView', reason: 'a' },
      { outputKind: 'thumbnail', scopeId: 's2', priority: 'ActiveView', reason: 'b' },
      { outputKind: 'room-boundary', scopeId: 's1', priority: 'ActiveView', reason: 'c' },
    ];
    expect(createInvalidationPlan(targets)).toHaveLength(3);
  });

  it('sorts by priority rank, most urgent first', () => {
    const targets: readonly InvalidationTarget[] = [
      { outputKind: 'thumbnail', scopeId: 's1', priority: 'AnalysisDeferred', reason: 'a' },
      { outputKind: 'thumbnail', scopeId: 's2', priority: 'InteractiveCritical', reason: 'b' },
      { outputKind: 'thumbnail', scopeId: 's3', priority: 'ActiveView', reason: 'c' },
    ];
    const plan = createInvalidationPlan(targets);
    expect(plan.map((t) => t.priority)).toEqual([
      'InteractiveCritical',
      'ActiveView',
      'AnalysisDeferred',
    ]);
  });

  it('breaks ties deterministically by scopeId then outputKind', () => {
    const targets: readonly InvalidationTarget[] = [
      { outputKind: 'thumbnail', scopeId: 'b', priority: 'ActiveView', reason: 'x' },
      { outputKind: 'sheet-preview', scopeId: 'a', priority: 'ActiveView', reason: 'y' },
    ];
    const plan = createInvalidationPlan(targets);
    expect(plan.map((t) => t.scopeId)).toEqual(['a', 'b']);
  });

  it('returns an empty plan for no targets', () => {
    expect(createInvalidationPlan([])).toEqual([]);
  });
});
