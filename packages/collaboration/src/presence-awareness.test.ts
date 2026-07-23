import { describe, expect, it } from 'vitest';
import {
  clearLocalPresence,
  createPresenceAwareness,
  parsePresenceState,
  readPresenceStates,
  setLocalPresence,
  syncAwarenessUpdate,
} from './presence-awareness';
import type { ParticipantPresenceState } from './presence-state';

function participant(overrides: Partial<ParticipantPresenceState> = {}): ParticipantPresenceState {
  return {
    participantId: 'p1',
    initials: 'AL',
    activeViewId: 'view-1',
    selection: ['wall-1'],
    cursor: { viewId: 'view-1', x: 10, y: 20 },
    lastActivityAtMs: 0,
    ...overrides,
  };
}

describe('presence over the real y-protocols Awareness class', () => {
  it('publishes local presence and reads it back from the same instance', () => {
    const awareness = createPresenceAwareness();
    setLocalPresence(awareness, participant());
    const states = readPresenceStates(awareness);
    expect(states.get(awareness.clientID)).toEqual(participant());
  });

  it('relays presence from one client to another via the real encode/decode wire format', () => {
    const alice = createPresenceAwareness();
    const bob = createPresenceAwareness();
    setLocalPresence(alice, participant({ participantId: 'alice' }));

    syncAwarenessUpdate(alice, bob);

    const bobsView = readPresenceStates(bob);
    expect(bobsView.get(alice.clientID)).toEqual(participant({ participantId: 'alice' }));
    // Bob never receives his own state from this relay - it only carries Alice's.
    expect(bobsView.has(bob.clientID)).toBe(false);
  });

  it('removes a participant from the map entirely on explicit disconnect (no synthetic "offline" entry)', () => {
    const alice = createPresenceAwareness();
    const bob = createPresenceAwareness();
    setLocalPresence(alice, participant({ participantId: 'alice' }));
    syncAwarenessUpdate(alice, bob);
    expect(readPresenceStates(bob).has(alice.clientID)).toBe(true);

    clearLocalPresence(alice);
    syncAwarenessUpdate(alice, bob);
    expect(readPresenceStates(bob).has(alice.clientID)).toBe(false);
  });

  it("a client update never mutates another client's independently-set state (no destructive merge)", () => {
    const alice = createPresenceAwareness();
    const bob = createPresenceAwareness();
    setLocalPresence(alice, participant({ participantId: 'alice', selection: ['wall-1'] }));
    setLocalPresence(bob, participant({ participantId: 'bob', selection: ['wall-2'] }));

    const hub = createPresenceAwareness();
    syncAwarenessUpdate(alice, hub);
    syncAwarenessUpdate(bob, hub);

    const combined = readPresenceStates(hub);
    expect(combined.get(alice.clientID)?.selection).toEqual(['wall-1']);
    expect(combined.get(bob.clientID)?.selection).toEqual(['wall-2']);
  });
});

describe('parsePresenceState (defends against malformed remote state)', () => {
  it('parses a well-formed state', () => {
    expect(parsePresenceState(participant())).toEqual(participant());
  });

  it('parses a state with a null cursor', () => {
    expect(parsePresenceState(participant({ cursor: null }))).toEqual(
      participant({ cursor: null }),
    );
  });

  it('returns null for non-object input', () => {
    expect(parsePresenceState(null)).toBeNull();
    expect(parsePresenceState('not an object')).toBeNull();
    expect(parsePresenceState(42)).toBeNull();
  });

  it('returns null when a required field is missing or the wrong type', () => {
    expect(parsePresenceState({ ...participant(), participantId: 42 })).toBeNull();
    expect(parsePresenceState({ ...participant(), selection: 'not-an-array' })).toBeNull();
    expect(parsePresenceState({ ...participant(), selection: [1, 2, 3] })).toBeNull();
    expect(parsePresenceState({ ...participant(), lastActivityAtMs: 'not-a-number' })).toBeNull();
  });

  it('treats a malformed cursor as null rather than rejecting the whole state', () => {
    const parsed = parsePresenceState({
      ...participant(),
      cursor: { viewId: 'v', x: 'not-a-number', y: 1 },
    });
    expect(parsed?.cursor).toBeNull();
  });
});
