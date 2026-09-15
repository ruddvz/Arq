import { describe, expect, it } from 'vitest';
import {
  emptySelection,
  extendSelection,
  isSelected,
  reconcileSelection,
  removeFromSelection,
  replaceSelection,
  selectedIds,
  setPrimarySelection,
  toggleSelection,
} from './selection-state';
import type { WorkspaceSelection } from './workspace-types';

function selection(primaryId: string | null, secondaryIds: readonly string[]): WorkspaceSelection {
  return { primaryId, secondaryIds: new Set(secondaryIds) };
}

function expectSelection(
  actual: WorkspaceSelection,
  primaryId: string | null,
  secondaryIds: readonly string[],
): void {
  expect(actual.primaryId).toBe(primaryId);
  expect([...actual.secondaryIds]).toEqual(secondaryIds);
  if (actual.primaryId === null) {
    expect(actual.secondaryIds.size).toBe(0);
  } else {
    expect(actual.secondaryIds.has(actual.primaryId)).toBe(false);
  }
}

describe('selection transitions', () => {
  it('creates and clears to the invariant empty shape', () => {
    expectSelection(emptySelection(), null, []);
    expectSelection(replaceSelection([]), null, []);
  });

  it('replaces one selection and clears prior secondary membership', () => {
    expectSelection(replaceSelection(['wall-7']), 'wall-7', []);
  });

  it('replaces many using first unique input as primary and collapses duplicates', () => {
    expectSelection(
      replaceSelection(['wall-7', 'door-2', 'wall-7', 'window-4', 'door-2']),
      'wall-7',
      ['door-2', 'window-4'],
    );
  });

  it('extends without changing the existing primary or duplicating members', () => {
    const start = selection('wall-7', ['door-2']);
    expectSelection(
      extendSelection(start, ['window-4', 'door-2', 'column-1']),
      'wall-7',
      ['door-2', 'window-4', 'column-1'],
    );
  });

  it('uses the first added ID as primary when extending an empty selection', () => {
    expectSelection(extendSelection(emptySelection(), ['door-2', 'wall-7']), 'door-2', [
      'wall-7',
    ]);
  });

  it('toggle-add preserves primary and toggle-remove removes only the target', () => {
    const start = selection('wall-7', ['door-2']);
    const added = toggleSelection(start, 'window-4');
    expectSelection(added, 'wall-7', ['door-2', 'window-4']);
    expectSelection(toggleSelection(added, 'door-2'), 'wall-7', ['window-4']);
  });

  it('promotes the earliest surviving secondary when the primary is toggled off', () => {
    const start = selection('wall-7', ['door-2', 'window-4']);
    expectSelection(toggleSelection(start, 'wall-7'), 'door-2', ['window-4']);
  });

  it('changes primary only for an already-selected ID and preserves membership', () => {
    const start = selection('wall-7', ['door-2', 'window-4']);
    expectSelection(setPrimarySelection(start, 'window-4'), 'window-4', ['wall-7', 'door-2']);
    expect(setPrimarySelection(start, 'roof-9')).toBe(start);
  });

  it('removes several IDs and repairs a removed primary using stable selection order', () => {
    const start = selection('wall-7', ['door-2', 'window-4', 'column-1']);
    expectSelection(removeFromSelection(start, ['wall-7', 'window-4']), 'door-2', ['column-1']);
  });

  it('reconciles invalid canonical IDs without guessing from their string shape', () => {
    const start = selection('wall-7', ['door-2', 'window-4']);
    const valid = new Set(['door-2', 'window-4']);
    expectSelection(reconcileSelection(start, (id) => valid.has(id)), 'door-2', ['window-4']);
  });

  it('reconciliation clears selection when no selected semantic IDs remain valid', () => {
    const start = selection('wall-7', ['door-2']);
    expectSelection(reconcileSelection(start, () => false), null, []);
  });

  it('bounds reconciliation work to selected IDs rather than a whole-project collection', () => {
    const ids = Array.from({ length: 5_000 }, (_, index) => `element-${index}`);
    const start = replaceSelection(ids);
    let validityChecks = 0;

    const next = reconcileSelection(start, () => {
      validityChecks += 1;
      return true;
    });

    expect(validityChecks).toBe(ids.length);
    expect(selectedIds(next)).toHaveLength(ids.length);
  });

  it('reports membership across primary and secondary IDs', () => {
    const start = selection('wall-7', ['door-2']);
    expect(isSelected(start, 'wall-7')).toBe(true);
    expect(isSelected(start, 'door-2')).toBe(true);
    expect(isSelected(start, 'window-4')).toBe(false);
    expect(selectedIds(start)).toEqual(['wall-7', 'door-2']);
  });

  it('does not mutate input selection objects or their Set instances', () => {
    const secondaries = new Set(['door-2', 'window-4']);
    const start: WorkspaceSelection = { primaryId: 'wall-7', secondaryIds: secondaries };
    const before = [...secondaries];

    const results = [
      extendSelection(start, ['column-1']),
      toggleSelection(start, 'door-2'),
      setPrimarySelection(start, 'window-4'),
      removeFromSelection(start, ['wall-7']),
      reconcileSelection(start, (id) => id !== 'door-2'),
    ];

    expect(start.primaryId).toBe('wall-7');
    expect(start.secondaryIds).toBe(secondaries);
    expect([...secondaries]).toEqual(before);
    for (const result of results) {
      expect(result).not.toBe(start);
      expect(result.secondaryIds).not.toBe(secondaries);
    }
  });

  it('normalises accidental primary duplication when a transition runs', () => {
    const malformed = selection('wall-7', ['wall-7', 'door-2']);
    expectSelection(extendSelection(malformed, []), 'wall-7', ['door-2']);
  });
});
