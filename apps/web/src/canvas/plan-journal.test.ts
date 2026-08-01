import { describe, expect, it } from 'vitest';
import { IDBKeyRange, IDBObjectStore, indexedDB } from 'fake-indexeddb';
import { worldPoint } from '@arq/geometry-2d';
import { createPlanJournal } from './plan-journal';
import type { DrawnWall } from './plan-document';

const WALL_A: DrawnWall = { id: 'drawn-wall-1', start: worldPoint(0, 0), end: worldPoint(3000, 0) };
const WALL_B: DrawnWall = {
  id: 'drawn-wall-2',
  start: worldPoint(3000, 0),
  end: worldPoint(3000, 4000),
};

let databaseCounter = 0;
function journal() {
  databaseCounter += 1;
  return createPlanJournal(`plan-journal-test-${databaseCounter}`, {
    indexedDB,
    IDBKeyRange,
  });
}

describe('createPlanJournal', () => {
  it('recovers an empty document from an empty journal', async () => {
    const j = journal();
    await expect(j.recover('p1')).resolves.toEqual({ walls: [], recoveredOperationCount: 0 });
    j.close();
  });

  it('replays adds and removes into the final document', async () => {
    const j = journal();
    expect((await j.append('p1', { kind: 'add-walls', walls: [WALL_A, WALL_B] })).status).toBe(
      'ready',
    );
    expect((await j.append('p1', { kind: 'remove-walls', wallIds: ['drawn-wall-1'] })).status).toBe(
      'ready',
    );
    const recovered = await j.recover('p1');
    expect(recovered.recoveredOperationCount).toBe(2);
    expect(recovered.walls.map((wall) => wall.id)).toEqual(['drawn-wall-2']);
    j.close();
  });

  it('undo appended as inverse operations replays to the undone state', async () => {
    const j = journal();
    await j.append('p1', { kind: 'add-walls', walls: [WALL_A] });
    // The app journals an undo by appending the applied inverse.
    await j.append('p1', { kind: 'remove-walls', wallIds: ['drawn-wall-1'] });
    const recovered = await j.recover('p1');
    expect(recovered.walls).toEqual([]);
    j.close();
  });

  it('does not journal note operations', async () => {
    const j = journal();
    expect((await j.append('p1', { kind: 'note', label: 'share' })).status).toBe('ready');
    await expect(j.recover('p1')).resolves.toEqual({ walls: [], recoveredOperationCount: 0 });
    j.close();
  });

  /**
   * The one write failure a user can act on. `packages/local-storage` proves
   * `appendOperationRecord` classifies a QuotaExceededError; nothing proved
   * that classification survived the journal layer as something the UI could
   * branch on, so the app collapsed every failure to "Journal write failed"
   * and dropped the only advice it had.
   *
   * fake-indexeddb enforces no real quota, so the failure is injected at the
   * table - the same technique journal-append.test.ts uses, and the only way
   * to reach this path without a live browser storage limit.
   */
  it('reports a full disk as a distinct, actionable write failure', async () => {
    const j = journal();
    // The journal owns its database, so the failure is injected at the store
    // the browser itself would fail at.
    const originalAdd = IDBObjectStore.prototype.add;
    IDBObjectStore.prototype.add = function throwQuota() {
      throw new DOMException('storage quota exceeded', 'QuotaExceededError');
    };
    try {
      const state = await j.append('p1', { kind: 'add-walls', walls: [WALL_A] });
      expect(state.status).toBe('write-failed');
      if (state.status !== 'write-failed') return;
      expect(state.cause).toBe('storage-full');
      // The reason has to tell the user what to do, not only that something broke.
      expect(state.reason).toMatch(/free space|export/iu);
    } finally {
      IDBObjectStore.prototype.add = originalAdd;
      j.close();
    }
  });

  it('reports any other write failure as an unknown cause rather than guessing', async () => {
    const j = journal();
    const originalAdd = IDBObjectStore.prototype.add;
    IDBObjectStore.prototype.add = function throwOther() {
      throw new DOMException('the backing store failed', 'UnknownError');
    };
    try {
      const state = await j.append('p1', { kind: 'add-walls', walls: [WALL_A] });
      expect(state.status).toBe('write-failed');
      if (state.status !== 'write-failed') return;
      expect(state.cause).toBe('unknown');
    } finally {
      IDBObjectStore.prototype.add = originalAdd;
      j.close();
    }
  });

  it('keeps projects separate', async () => {
    const j = journal();
    await j.append('p1', { kind: 'add-walls', walls: [WALL_A] });
    await j.append('p2', { kind: 'add-walls', walls: [WALL_B] });
    expect((await j.recover('p1')).walls.map((wall) => wall.id)).toEqual(['drawn-wall-1']);
    expect((await j.recover('p2')).walls.map((wall) => wall.id)).toEqual(['drawn-wall-2']);
    j.close();
  });
});
