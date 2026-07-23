/**
 * ARQ-165: collaboration: implement revision snapshots.
 *
 * Same Y.Map CRDT pattern as comments-store.ts (ARQ-163) and
 * issues-store.ts (ARQ-164): revision snapshots are persistent structured
 * metadata, not geometry. "Destructive conflicts are not silently merged"
 * holds the same way - adding a snapshot is purely additive, and renaming
 * only ever touches that one snapshot's own label/description, never its
 * immutable stateReference/createdAtMs or another snapshot's data.
 *
 * `listRevisionSnapshots` treats every entry as potentially untrusted,
 * same trust boundary as the comments/issues stores.
 */

import * as Y from 'yjs';
import type { RevisionSnapshot } from './revision-snapshot';

const REVISION_SNAPSHOTS_MAP_NAME = 'revisionSnapshots';

export function createRevisionSnapshotsDoc(): Y.Doc {
  return new Y.Doc();
}

function revisionSnapshotsMap(doc: Y.Doc): Y.Map<Y.Map<unknown>> {
  return doc.getMap(REVISION_SNAPSHOTS_MAP_NAME);
}

/** Adds a brand-new revision snapshot. Throws if this exact id already exists - a local misuse guard, not a network race: callers are expected to supply globally-unique ids (e.g. UUIDs). */
export function addRevisionSnapshot(doc: Y.Doc, snapshot: RevisionSnapshot): void {
  const map = revisionSnapshotsMap(doc);
  if (map.has(snapshot.id)) {
    throw new RangeError(`revision snapshot ${snapshot.id} already exists`);
  }
  const entry = new Y.Map<unknown>();
  entry.set('id', snapshot.id);
  entry.set('label', snapshot.label);
  entry.set('description', snapshot.description);
  entry.set('authorParticipantId', snapshot.authorParticipantId);
  entry.set('createdAtMs', snapshot.createdAtMs);
  entry.set('stateReference', snapshot.stateReference);
  map.set(snapshot.id, entry);
}

/** Edits a snapshot's label/description only - never its stateReference or createdAtMs, which are immutable once created (see revision-snapshot.ts). A no-op for an unknown or already-removed snapshot id. */
export function renameRevisionSnapshot(
  doc: Y.Doc,
  snapshotId: string,
  update: { readonly label: string; readonly description?: string },
): void {
  const entry = revisionSnapshotsMap(doc).get(snapshotId);
  if (entry === undefined) {
    return;
  }
  const trimmedLabel = update.label.trim();
  if (trimmedLabel.length === 0) {
    throw new RangeError('revision snapshot label must not be empty');
  }
  entry.set('label', trimmedLabel);
  if (update.description !== undefined) {
    entry.set('description', update.description.trim());
  }
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

/** Defensively parses one Y.Map entry into a RevisionSnapshot; returns null for anything malformed rather than throwing - a remote peer's document state is untrusted input. */
function parseRevisionSnapshotEntry(entry: Y.Map<unknown>): RevisionSnapshot | null {
  const id = entry.get('id');
  const label = entry.get('label');
  const description = entry.get('description');
  const authorParticipantId = entry.get('authorParticipantId');
  const createdAtMs = entry.get('createdAtMs');
  const stateReference = entry.get('stateReference');

  if (
    typeof id !== 'string' ||
    typeof label !== 'string' ||
    typeof description !== 'string' ||
    typeof authorParticipantId !== 'string' ||
    !isFiniteNumber(createdAtMs) ||
    typeof stateReference !== 'string'
  ) {
    return null;
  }

  return { id, label, description, authorParticipantId, createdAtMs, stateReference };
}

/** Every revision snapshot in the document, oldest first - the natural chronological revision history. A malformed entry is skipped rather than rejecting the whole read. */
export function listRevisionSnapshots(doc: Y.Doc): readonly RevisionSnapshot[] {
  const results: RevisionSnapshot[] = [];
  for (const entry of revisionSnapshotsMap(doc).values()) {
    const parsed = parseRevisionSnapshotEntry(entry);
    if (parsed !== null) {
      results.push(parsed);
    }
  }
  return results.sort((a, b) => a.createdAtMs - b.createdAtMs);
}

/** Relays only what `source` has that `target` does not yet, exactly as comments-store.ts's syncCommentsUpdate does. */
export function syncRevisionSnapshotsUpdate(source: Y.Doc, target: Y.Doc): void {
  const update = Y.encodeStateAsUpdate(source, Y.encodeStateVector(target));
  Y.applyUpdate(target, update, 'sync');
}
