import { describe, expect, it } from 'vitest';
import {
  derivedChanges,
  diffIsEmpty,
  diffSnapshots,
  requestedChanges,
  type ElementSnapshot,
  type ModelSnapshot,
} from './semantic-diff';

function element(
  elementId: string,
  category: string,
  properties: Record<string, unknown>,
  label?: string,
): ElementSnapshot {
  return { elementId, category, properties, ...(label === undefined ? {} : { label }) };
}

function snapshot(revision: number, elements: readonly ElementSnapshot[]): ModelSnapshot {
  return { revision, elements };
}

const BEFORE = snapshot(12, [
  element('wall-3', 'Wall', { start: { x: 0, y: 0 }, end: { x: 5000, y: 0 } }, 'Wall 3'),
  element('room-2', 'Room', { name: 'Office', areaM2: 12.4 }, 'Office'),
]);

describe('diffSnapshots', () => {
  it('reports a moved wall as a property change with both sides', () => {
    const after = snapshot(13, [
      element('wall-3', 'Wall', { start: { x: 0, y: 0 }, end: { x: 5000, y: 200 } }, 'Wall 3'),
      element('room-2', 'Room', { name: 'Office', areaM2: 12.4 }, 'Office'),
    ]);

    const diff = diffSnapshots(BEFORE, after, { requestedElementIds: new Set(['wall-3']) });

    expect(diff.changes).toHaveLength(1);
    const change = diff.changes[0];
    expect(change?.kind).toBe('modified');
    if (change?.kind !== 'modified') return;
    expect(change.label).toBe('Wall 3');
    expect(change.properties).toEqual([
      { key: 'end', before: { x: 5000, y: 0 }, after: { x: 5000, y: 200 } },
    ]);
  });

  it('labels a consequence as derived rather than as a second decision', () => {
    // A room's area changing is a consequence of the wall moving, not a second
    // thing the AI decided to do.
    const after = snapshot(13, [
      element('wall-3', 'Wall', { start: { x: 0, y: 0 }, end: { x: 5000, y: 200 } }, 'Wall 3'),
      element('room-2', 'Room', { name: 'Office', areaM2: 12.1 }, 'Office'),
    ]);

    const diff = diffSnapshots(BEFORE, after, { requestedElementIds: new Set(['wall-3']) });

    expect(requestedChanges(diff).map((change) => change.elementId)).toEqual(['wall-3']);
    expect(derivedChanges(diff).map((change) => change.elementId)).toEqual(['room-2']);
    expect(diff.summary.derived).toBe(1);
  });

  it('reports an added element', () => {
    const after = snapshot(13, [
      ...BEFORE.elements,
      element('door-9', 'Door', { width: 900 }, 'D09'),
    ]);

    const diff = diffSnapshots(BEFORE, after, { requestedElementIds: new Set(['door-9']) });

    expect(diff.changes).toEqual([
      {
        kind: 'added',
        elementId: 'door-9',
        category: 'Door',
        label: 'D09',
        origin: 'requested',
      },
    ]);
  });

  it('reports a removed element', () => {
    const after = snapshot(13, [BEFORE.elements[1]!]);

    const diff = diffSnapshots(BEFORE, after, { requestedElementIds: new Set(['wall-3']) });

    expect(diff.changes).toEqual([
      {
        kind: 'removed',
        elementId: 'wall-3',
        category: 'Wall',
        label: 'Wall 3',
        origin: 'requested',
      },
    ]);
    expect(diff.summary.removed).toBe(1);
  });

  it('does not invent a previous value for a property that did not exist', () => {
    // "undefined -> 200" tells a reviewer about a previous state that never was.
    const after = snapshot(13, [
      element('wall-3', 'Wall', { ...BEFORE.elements[0]!.properties, fireRating: 60 }, 'Wall 3'),
      BEFORE.elements[1]!,
    ]);

    const diff = diffSnapshots(BEFORE, after);
    const change = diff.changes[0];
    expect(change?.kind).toBe('modified');
    if (change?.kind !== 'modified') return;

    expect(change.properties).toEqual([{ key: 'fireRating', after: 60 }]);
    expect(change.properties[0]).not.toHaveProperty('before');
  });

  it('does not invent an after value for a property that was removed', () => {
    const after = snapshot(13, [
      element('wall-3', 'Wall', { start: { x: 0, y: 0 } }, 'Wall 3'),
      BEFORE.elements[1]!,
    ]);

    const diff = diffSnapshots(BEFORE, after);
    const change = diff.changes[0];
    if (change?.kind !== 'modified') return;

    expect(change.properties).toEqual([{ key: 'end', before: { x: 5000, y: 0 } }]);
    expect(change.properties[0]).not.toHaveProperty('after');
  });

  it('compares nested values structurally, not by reference', () => {
    const after = snapshot(13, [
      element('wall-3', 'Wall', { start: { x: 0, y: 0 }, end: { x: 5000, y: 0 } }, 'Wall 3'),
      BEFORE.elements[1]!,
    ]);

    expect(diffSnapshots(BEFORE, after).changes).toEqual([]);
  });

  it('compares arrays element by element', () => {
    const withIds = snapshot(12, [element('room-2', 'Room', { boundaryIds: ['a', 'b'] })]);
    const same = snapshot(13, [element('room-2', 'Room', { boundaryIds: ['a', 'b'] })]);
    const reordered = snapshot(13, [element('room-2', 'Room', { boundaryIds: ['b', 'a'] })]);

    expect(diffSnapshots(withIds, same).changes).toEqual([]);
    // Boundary order is the traversal direction, so a reorder is a real change.
    expect(diffSnapshots(withIds, reordered).changes).toHaveLength(1);
  });

  it('leaves out properties the caller names as bookkeeping', () => {
    const before = snapshot(12, [element('wall-3', 'Wall', { length: 5000, modifiedAt: 'a' })]);
    const after = snapshot(13, [element('wall-3', 'Wall', { length: 5000, modifiedAt: 'b' })]);

    expect(
      diffSnapshots(before, after, { ignoredProperties: new Set(['modifiedAt']) }).changes,
    ).toEqual([]);
  });

  it('sorts by element id, so a review list does not reorder under the cursor', () => {
    const before = snapshot(12, [
      element('z-wall', 'Wall', { length: 1 }),
      element('a-wall', 'Wall', { length: 1 }),
    ]);
    const after = snapshot(13, [
      element('z-wall', 'Wall', { length: 2 }),
      element('a-wall', 'Wall', { length: 2 }),
    ]);

    expect(diffSnapshots(before, after).changes.map((change) => change.elementId)).toEqual([
      'a-wall',
      'z-wall',
    ]);
  });

  it('falls back to the id when an element has no label', () => {
    const before = snapshot(12, [element('wall-3', 'Wall', { length: 1 })]);
    const after = snapshot(13, [element('wall-3', 'Wall', { length: 2 })]);

    expect(diffSnapshots(before, after).changes[0]?.label).toBe('wall-3');
  });

  it('treats everything as derived when the caller names nothing as requested', () => {
    const after = snapshot(13, [
      element('wall-3', 'Wall', { start: { x: 0, y: 0 }, end: { x: 1, y: 1 } }, 'Wall 3'),
      BEFORE.elements[1]!,
    ]);

    expect(requestedChanges(diffSnapshots(BEFORE, after))).toEqual([]);
  });

  it('carries both revisions, so a diff can be checked against the project it describes', () => {
    const diff = diffSnapshots(BEFORE, snapshot(13, BEFORE.elements));

    expect(diff.fromRevision).toBe(12);
    expect(diff.toRevision).toBe(13);
  });

  it('reports an empty diff for a proposal that would change nothing', () => {
    expect(diffIsEmpty(diffSnapshots(BEFORE, snapshot(13, BEFORE.elements)))).toBe(true);
  });
});
