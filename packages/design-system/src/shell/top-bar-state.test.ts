import { describe, expect, it } from 'vitest';
import {
  describeSaveState,
  describeSyncState,
  undoTooltip,
  redoTooltip,
  resolveProjectNameEdit,
  type SaveState,
  type SyncState,
} from './top-bar-state';

describe('describeSaveState', () => {
  const cases: ReadonlyArray<readonly [SaveState, string]> = [
    // A shell with no project open must have a truthful value to render; before
    // this state existed, apps/web passed 'saved' and the top bar permanently
    // claimed a save that had never happened.
    ['no-project', 'No project open'],
    // Each label names the persistence tier. A bare 'Saved' would read as a
    // portable .arq write, which no current path performs.
    ['saved', 'Saved locally'],
    ['saving', 'Saving locally…'],
    ['unsaved-changes', 'Unsaved changes'],
    ['recovered', 'Recovered locally'],
  ];
  for (const [state, expected] of cases) {
    it(`describes ${state}`, () => {
      expect(describeSaveState(state)).toBe(expected);
    });
  }
});

describe('describeSyncState', () => {
  const cases: ReadonlyArray<readonly [SyncState, string]> = [
    ['synced', 'Synced'],
    ['syncing', 'Syncing…'],
    ['offline', 'Offline'],
    ['sync-error', 'Sync error'],
  ];
  for (const [state, expected] of cases) {
    it(`describes ${state}`, () => {
      expect(describeSyncState(state)).toBe(expected);
    });
  }
});

describe('undoTooltip', () => {
  it('names the action when undo is available', () => {
    expect(undoTooltip({ canUndo: true, canRedo: false }, 'move wall')).toBe('Undo move wall');
  });

  it('is null when there is nothing to undo', () => {
    expect(undoTooltip({ canUndo: false, canRedo: false }, 'move wall')).toBeNull();
  });

  it('is null when there is no label, even if undo is available', () => {
    expect(undoTooltip({ canUndo: true, canRedo: false }, null)).toBeNull();
  });
});

describe('redoTooltip', () => {
  it('names the action when redo is available', () => {
    expect(redoTooltip({ canUndo: false, canRedo: true }, 'delete room')).toBe('Redo delete room');
  });

  it('is null when there is nothing to redo', () => {
    expect(redoTooltip({ canUndo: false, canRedo: false }, 'delete room')).toBeNull();
  });
});

describe('resolveProjectNameEdit', () => {
  it('keeps the current name when not committed (Escape)', () => {
    expect(resolveProjectNameEdit('Old name', 'New name', false)).toBe('Old name');
  });

  it('commits the trimmed proposed name', () => {
    expect(resolveProjectNameEdit('Old name', '  New name  ', true)).toBe('New name');
  });

  it('keeps the current name when the committed value is empty', () => {
    expect(resolveProjectNameEdit('Old name', '   ', true)).toBe('Old name');
  });
});
