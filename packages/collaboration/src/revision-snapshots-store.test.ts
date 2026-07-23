import { describe, expect, it } from 'vitest';
import * as Y from 'yjs';
import { createRevisionSnapshot } from './revision-snapshot';
import {
  addRevisionSnapshot,
  createRevisionSnapshotsDoc,
  listRevisionSnapshots,
  renameRevisionSnapshot,
  syncRevisionSnapshotsUpdate,
} from './revision-snapshots-store';

const snapshotInput = {
  authorParticipantId: 'alice',
  createdAtMs: 1000,
  stateReference: 'journal-seq:482',
};

describe('addRevisionSnapshot / listRevisionSnapshots (single document)', () => {
  it('adds and lists a revision snapshot', () => {
    const doc = createRevisionSnapshotsDoc();
    addRevisionSnapshot(
      doc,
      createRevisionSnapshot({ id: 'r1', label: 'Submitted for permit', ...snapshotInput }),
    );
    expect(listRevisionSnapshots(doc)).toEqual([
      createRevisionSnapshot({ id: 'r1', label: 'Submitted for permit', ...snapshotInput }),
    ]);
  });

  it('lists snapshots oldest first regardless of insertion order', () => {
    const doc = createRevisionSnapshotsDoc();
    addRevisionSnapshot(
      doc,
      createRevisionSnapshot({ id: 'r2', label: 'B', ...snapshotInput, createdAtMs: 2000 }),
    );
    addRevisionSnapshot(
      doc,
      createRevisionSnapshot({ id: 'r1', label: 'A', ...snapshotInput, createdAtMs: 1000 }),
    );
    expect(listRevisionSnapshots(doc).map((s) => s.id)).toEqual(['r1', 'r2']);
  });

  it('throws when adding a snapshot with an id that already exists', () => {
    const doc = createRevisionSnapshotsDoc();
    addRevisionSnapshot(doc, createRevisionSnapshot({ id: 'r1', label: 'A', ...snapshotInput }));
    expect(() =>
      addRevisionSnapshot(doc, createRevisionSnapshot({ id: 'r1', label: 'A', ...snapshotInput })),
    ).toThrow(RangeError);
  });

  it('renameRevisionSnapshot updates label and description without touching stateReference or createdAtMs', () => {
    const doc = createRevisionSnapshotsDoc();
    addRevisionSnapshot(doc, createRevisionSnapshot({ id: 'r1', label: 'A', ...snapshotInput }));
    renameRevisionSnapshot(doc, 'r1', { label: 'Renamed', description: 'New description' });
    const snapshot = listRevisionSnapshots(doc)[0];
    expect(snapshot?.label).toBe('Renamed');
    expect(snapshot?.description).toBe('New description');
    expect(snapshot?.stateReference).toBe(snapshotInput.stateReference);
    expect(snapshot?.createdAtMs).toBe(snapshotInput.createdAtMs);
  });

  it('renameRevisionSnapshot rejects an empty label', () => {
    const doc = createRevisionSnapshotsDoc();
    addRevisionSnapshot(doc, createRevisionSnapshot({ id: 'r1', label: 'A', ...snapshotInput }));
    expect(() => renameRevisionSnapshot(doc, 'r1', { label: '' })).toThrow(RangeError);
  });

  it('renameRevisionSnapshot on an unknown snapshot id is a no-op, not an error', () => {
    const doc = createRevisionSnapshotsDoc();
    expect(() => renameRevisionSnapshot(doc, 'does-not-exist', { label: 'X' })).not.toThrow();
    expect(listRevisionSnapshots(doc)).toEqual([]);
  });
});

describe('syncRevisionSnapshotsUpdate (real cross-document CRDT merge)', () => {
  it('relays a snapshot added on one document to another', () => {
    const alice = createRevisionSnapshotsDoc();
    const bob = createRevisionSnapshotsDoc();
    addRevisionSnapshot(alice, createRevisionSnapshot({ id: 'r1', label: 'A', ...snapshotInput }));

    syncRevisionSnapshotsUpdate(alice, bob);

    expect(listRevisionSnapshots(bob)).toEqual(listRevisionSnapshots(alice));
  });

  it('preserves both snapshots when two peers concurrently add different snapshots (no destructive merge)', () => {
    const alice = createRevisionSnapshotsDoc();
    const bob = createRevisionSnapshotsDoc();
    syncRevisionSnapshotsUpdate(alice, bob);

    addRevisionSnapshot(
      alice,
      createRevisionSnapshot({ id: 'from-alice', label: 'A', ...snapshotInput }),
    );
    addRevisionSnapshot(
      bob,
      createRevisionSnapshot({ id: 'from-bob', label: 'B', ...snapshotInput }),
    );

    syncRevisionSnapshotsUpdate(alice, bob);
    syncRevisionSnapshotsUpdate(bob, alice);

    expect(
      listRevisionSnapshots(alice)
        .map((s) => s.id)
        .sort(),
    ).toEqual(['from-alice', 'from-bob']);
    expect(
      listRevisionSnapshots(bob)
        .map((s) => s.id)
        .sort(),
    ).toEqual(['from-alice', 'from-bob']);
  });

  it('converges to the same label on both peers after a concurrent rename of the same snapshot', () => {
    const alice = createRevisionSnapshotsDoc();
    const bob = createRevisionSnapshotsDoc();
    addRevisionSnapshot(
      alice,
      createRevisionSnapshot({ id: 'r1', label: 'Original', ...snapshotInput }),
    );
    syncRevisionSnapshotsUpdate(alice, bob);

    renameRevisionSnapshot(alice, 'r1', { label: 'From Alice' });
    renameRevisionSnapshot(bob, 'r1', { label: 'From Bob' });

    syncRevisionSnapshotsUpdate(alice, bob);
    syncRevisionSnapshotsUpdate(bob, alice);

    const aliceLabel = listRevisionSnapshots(alice)[0]?.label;
    const bobLabel = listRevisionSnapshots(bob)[0]?.label;
    expect(aliceLabel).toBe(bobLabel);
  });

  it('never throws when reading a document containing a malformed snapshot entry (defends against untrusted remote state)', () => {
    const doc = createRevisionSnapshotsDoc();
    const map = doc.getMap('revisionSnapshots');
    const malformed = new Y.Map<unknown>();
    malformed.set('id', 'bad');
    malformed.set('createdAtMs', 'not-a-number'); // wrong type - should be skipped, not thrown
    map.set('bad', malformed);

    addRevisionSnapshot(
      doc,
      createRevisionSnapshot({ id: 'good', label: 'Good', ...snapshotInput }),
    );

    expect(() => listRevisionSnapshots(doc)).not.toThrow();
    expect(listRevisionSnapshots(doc).map((s) => s.id)).toEqual(['good']);
  });
});
