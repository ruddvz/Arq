import { describe, expect, it } from 'vitest';
import {
  buildVisiblePresence,
  deriveInitials,
  derivePresenceStatus,
  type ParticipantPresenceState,
} from './presence-state';

describe('deriveInitials', () => {
  it('takes the first letter of the first and last word for a multi-word name', () => {
    expect(deriveInitials('Ada Lovelace')).toBe('AL');
    expect(deriveInitials('Grace Brewster Hopper')).toBe('GH');
  });

  it('takes the first two characters for a single word', () => {
    expect(deriveInitials('Ada')).toBe('AD');
  });

  it('trims and collapses extra whitespace', () => {
    expect(deriveInitials('  Ada   Lovelace  ')).toBe('AL');
  });

  it('returns "?" for empty or whitespace-only input rather than an empty string', () => {
    expect(deriveInitials('')).toBe('?');
    expect(deriveInitials('   ')).toBe('?');
  });
});

describe('derivePresenceStatus', () => {
  it('is active when elapsed time is below the idle threshold', () => {
    expect(derivePresenceStatus(1000, 1000 + 59_000, 60_000)).toBe('active');
  });

  it('is idle once elapsed time reaches the idle threshold', () => {
    expect(derivePresenceStatus(1000, 1000 + 60_000, 60_000)).toBe('idle');
  });

  it('treats a future lastActivityAtMs (clock skew) as active rather than negative elapsed', () => {
    expect(derivePresenceStatus(2000, 1000, 60_000)).toBe('active');
  });

  it('uses DEFAULT_IDLE_THRESHOLD_MS when no threshold is given', () => {
    expect(derivePresenceStatus(0, 0)).toBe('active');
  });
});

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

describe('buildVisiblePresence', () => {
  it("excludes the viewer's own participant entry", () => {
    const states = new Map([[1, participant({ participantId: 'self' })]]);
    const visible = buildVisiblePresence(states, {
      viewerViewId: 'view-1',
      selfParticipantId: 'self',
      isSelectionPermitted: () => true,
      nowMs: 0,
    });
    expect(visible).toEqual([]);
  });

  it('shows the cursor only when the participant is in the same view as the viewer', () => {
    const states = new Map([[1, participant({ cursor: { viewId: 'view-2', x: 5, y: 5 } })]]);
    const visible = buildVisiblePresence(states, {
      viewerViewId: 'view-1',
      selfParticipantId: 'self',
      isSelectionPermitted: () => true,
      nowMs: 0,
    });
    expect(visible[0]?.cursor).toBeNull();
  });

  it('includes the cursor position when in the same view', () => {
    const states = new Map([[1, participant()]]);
    const visible = buildVisiblePresence(states, {
      viewerViewId: 'view-1',
      selfParticipantId: 'self',
      isSelectionPermitted: () => true,
      nowMs: 0,
    });
    expect(visible[0]?.cursor).toEqual({ x: 10, y: 20 });
  });

  it('hides selection when not permitted, without hiding anything else', () => {
    const states = new Map([[1, participant()]]);
    const visible = buildVisiblePresence(states, {
      viewerViewId: 'view-1',
      selfParticipantId: 'self',
      isSelectionPermitted: () => false,
      nowMs: 0,
    });
    expect(visible[0]?.selection).toEqual([]);
    expect(visible[0]?.initials).toBe('AL');
  });

  it('shows selection when permitted', () => {
    const states = new Map([[1, participant()]]);
    const visible = buildVisiblePresence(states, {
      viewerViewId: 'view-1',
      selfParticipantId: 'self',
      isSelectionPermitted: () => true,
      nowMs: 0,
    });
    expect(visible[0]?.selection).toEqual(['wall-1']);
  });

  it('derives idle status for a participant inactive past the threshold', () => {
    const states = new Map([[1, participant({ lastActivityAtMs: 0 })]]);
    const visible = buildVisiblePresence(states, {
      viewerViewId: 'view-1',
      selfParticipantId: 'self',
      isSelectionPermitted: () => true,
      nowMs: 120_000,
      idleThresholdMs: 60_000,
    });
    expect(visible[0]?.status).toBe('idle');
  });
});
