import { describe, expect, it } from 'vitest';
import { applySelectionIntent } from './selection-intent';
import { selectedIds } from './selection-state';
import type { WorkspaceSelection } from './workspace-types';

function selection(primaryId: string | null, secondaryIds: readonly string[]): WorkspaceSelection {
  return { primaryId, secondaryIds: new Set(secondaryIds) };
}

describe('applySelectionIntent', () => {
  it('clears selection without depending on the previous surface state', () => {
    const start = selection('wall-1', ['door-2']);
    const next = applySelectionIntent(start, { kind: 'clear' });
    expect(next.primaryId).toBeNull();
    expect([...next.secondaryIds]).toEqual([]);
  });

  it('uses one replace contract for any surface-provided semantic IDs', () => {
    const start = selection('wall-1', ['door-2']);
    const next = applySelectionIntent(start, {
      kind: 'replace',
      ids: ['window-3', 'column-4', 'window-3'],
    });
    expect(selectedIds(next)).toEqual(['window-3', 'column-4']);
  });

  it('extends while preserving the current primary', () => {
    const start = selection('wall-1', ['door-2']);
    const next = applySelectionIntent(start, {
      kind: 'extend',
      ids: ['window-3', 'door-2'],
    });
    expect(selectedIds(next)).toEqual(['wall-1', 'door-2', 'window-3']);
  });

  it('toggle-many follows explicit input order and repairs primary deterministically', () => {
    const start = selection('wall-1', ['door-2', 'window-3']);
    const next = applySelectionIntent(start, {
      kind: 'toggle',
      ids: ['wall-1', 'column-4', 'door-2'],
    });
    expect(selectedIds(next)).toEqual(['window-3', 'column-4']);
    expect(next.primaryId).toBe('window-3');
  });

  it('does not mutate the caller-owned starting selection', () => {
    const secondaries = new Set(['door-2']);
    const start: WorkspaceSelection = { primaryId: 'wall-1', secondaryIds: secondaries };

    applySelectionIntent(start, { kind: 'extend', ids: ['window-3'] });
    applySelectionIntent(start, { kind: 'toggle', ids: ['wall-1'] });

    expect(start.primaryId).toBe('wall-1');
    expect(start.secondaryIds).toBe(secondaries);
    expect([...secondaries]).toEqual(['door-2']);
  });
});
