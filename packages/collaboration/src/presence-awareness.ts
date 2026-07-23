/**
 * ARQ-162: collaboration: prototype presence only.
 *
 * Wires presence-state.ts's plain data shape into the real `y-protocols`
 * Awareness protocol (`@arq/collaboration`'s own package description
 * already named Yjs for exactly this: "Presence, comments, and operation
 * sync (Yjs for metadata; typed operations for geometry, per §16.6)";
 * open-source/TECHNOLOGY-MATRIX.csv already recorded Yjs with treatment
 * "spike" and note "Presence and comments" - this issue is exactly that
 * spike, deliberately presence-only, not the full CRDT document-sync half
 * of that note (out of scope per this issue's own non-goal against
 * expanding into later release scope).
 *
 * Awareness's own design already gives "destructive conflicts are not
 * silently merged" for free, by construction: each client may only ever
 * write its OWN state (`setLocalState`); a remote client's entry is never
 * merged with anything, it is simply replaced wholesale by that client's
 * own newer update, or removed entirely on disconnect/timeout. There is
 * no cross-participant merge step anywhere in this protocol for a
 * conflict to happen in.
 *
 * `readPresenceStates` treats every remote participant's state as
 * untrusted input (in a real deployment it arrives over the network from
 * another client, same trust boundary as `@arq/project-format`'s
 * `importArchive` or `@arq/dxf-adapter`'s `parseDxf`) - a malformed entry
 * is skipped, never thrown, and never allowed to corrupt the whole read.
 */

import * as Y from 'yjs';
import { Awareness, applyAwarenessUpdate, encodeAwarenessUpdate } from 'y-protocols/awareness';
import type { ParticipantPresenceState, PresenceCursor } from './presence-state';

/** Creates a fresh Awareness instance backed by its own Y.Doc - one per collaborating client, per y-protocols' own design (a Y.Doc's clientID identifies the Awareness instance). */
export function createPresenceAwareness(): Awareness {
  return new Awareness(new Y.Doc());
}

/** Publishes this client's own presence - the only state this client is ever allowed to write, by construction of the Awareness protocol itself. */
export function setLocalPresence(awareness: Awareness, state: ParticipantPresenceState): void {
  awareness.setLocalState(state);
}

/** Marks this client as offline (Awareness removes the entry entirely - see presence-state.ts's doc comment on why "offline" has no status value of its own). */
export function clearLocalPresence(awareness: Awareness): void {
  awareness.setLocalState(null);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function parseCursor(value: unknown): PresenceCursor | null {
  if (value === null) {
    return null;
  }
  if (typeof value !== 'object') {
    return null;
  }
  const candidate = value as Record<string, unknown>;
  if (
    typeof candidate.viewId !== 'string' ||
    !isFiniteNumber(candidate.x) ||
    !isFiniteNumber(candidate.y)
  ) {
    return null;
  }
  return { viewId: candidate.viewId, x: candidate.x, y: candidate.y };
}

/** Defensively parses one raw Awareness state entry; returns null for anything malformed rather than throwing - a remote participant's state is untrusted input. */
export function parsePresenceState(raw: unknown): ParticipantPresenceState | null {
  if (typeof raw !== 'object' || raw === null) {
    return null;
  }
  const candidate = raw as Record<string, unknown>;
  if (
    typeof candidate.participantId !== 'string' ||
    typeof candidate.initials !== 'string' ||
    !(typeof candidate.activeViewId === 'string' || candidate.activeViewId === null) ||
    !Array.isArray(candidate.selection) ||
    !candidate.selection.every((item): item is string => typeof item === 'string') ||
    !isFiniteNumber(candidate.lastActivityAtMs)
  ) {
    return null;
  }
  const cursor = 'cursor' in candidate ? parseCursor(candidate.cursor) : null;
  return {
    participantId: candidate.participantId,
    initials: candidate.initials,
    activeViewId: candidate.activeViewId,
    selection: candidate.selection,
    cursor,
    lastActivityAtMs: candidate.lastActivityAtMs,
  };
}

/** Reads every currently-present participant's state (already-disconnected/timed-out clients are simply absent - Awareness's own doing). A malformed entry is skipped rather than rejecting the whole read. */
export function readPresenceStates(
  awareness: Awareness,
): ReadonlyMap<number, ParticipantPresenceState> {
  const result = new Map<number, ParticipantPresenceState>();
  for (const [clientId, rawState] of awareness.getStates()) {
    const parsed = parsePresenceState(rawState);
    if (parsed !== null) {
      result.set(clientId, parsed);
    }
  }
  return result;
}

/**
 * Relays one Awareness instance's current state to another, exactly as a
 * real transport would forward an encoded update between two clients -
 * useful for prototyping/testing without a real network layer, and
 * exercises the genuine encode/decode wire format rather than sharing
 * objects in-process.
 *
 * Deliberately encodes every clientID `source.meta` has ever known, not
 * just `source.getStates().keys()`: a client whose state was just set to
 * null is removed from `states` immediately (see clearLocalPresence) but
 * stays in `meta` (which is exactly what still lets encodeAwarenessUpdate
 * produce a correct null-state removal update for it) - encoding from
 * `getStates()` alone would silently never forward a disconnect.
 */
export function syncAwarenessUpdate(source: Awareness, target: Awareness): void {
  const update = encodeAwarenessUpdate(source, [...source.meta.keys()]);
  applyAwarenessUpdate(target, update, 'sync');
}
