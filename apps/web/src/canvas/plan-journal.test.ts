import { describe, expect, it } from 'vitest';
import { IDBKeyRange, indexedDB } from 'fake-indexeddb';
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

  it('keeps projects separate', async () => {
    const j = journal();
    await j.append('p1', { kind: 'add-walls', walls: [WALL_A] });
    await j.append('p2', { kind: 'add-walls', walls: [WALL_B] });
    expect((await j.recover('p1')).walls.map((wall) => wall.id)).toEqual(['drawn-wall-1']);
    expect((await j.recover('p2')).walls.map((wall) => wall.id)).toEqual(['drawn-wall-2']);
    j.close();
  });
});
