/**
 * ARQ-162: collaboration: prototype presence only.
 *
 * Pure data shapes and derivation logic for blueprint section 85
 * ("Presence"): participant initials, active view, selection where
 * permitted, cursor in same view, idle state, offline state. Deliberately
 * has no dependency on Yjs at all - presence-awareness.ts is the thin
 * layer that wires this shape into the real `y-protocols` Awareness
 * protocol; this module is plain, easily-tested data logic.
 *
 * "Offline state" (section 85) is NOT a status value this module
 * computes - it is represented one layer up, by a participant's simple
 * absence from the awareness map (Awareness already removes a client's
 * state on explicit disconnect or after its own outdatedTimeout, see
 * presence-awareness.ts). Inventing a synthetic 'offline' enum member
 * here, with no real signal behind it, would be exactly the kind of
 * fabricated status this backlog's own discipline rules out - "idle" is
 * the only status this module derives, from real elapsed time since the
 * participant's own last-activity timestamp.
 */

export type PresenceStatus = 'active' | 'idle';

/** No local activity for this long is considered idle (present but not interacting). */
export const DEFAULT_IDLE_THRESHOLD_MS = 60_000;

export interface PresenceCursor {
  readonly viewId: string;
  readonly x: number;
  readonly y: number;
}

/** The shape each participant writes as their own Awareness local state - never another participant's, by construction (see presence-awareness.ts). */
export interface ParticipantPresenceState {
  readonly participantId: string;
  readonly initials: string;
  readonly activeViewId: string | null;
  readonly selection: readonly string[];
  readonly cursor: PresenceCursor | null;
  readonly lastActivityAtMs: number;
}

export interface VisibleParticipantPresence {
  readonly participantId: string;
  readonly initials: string;
  readonly activeViewId: string | null;
  readonly status: PresenceStatus;
  /** Empty when selection is not permitted for this viewer - never the participant's real selection leaked past that check. */
  readonly selection: readonly string[];
  /** Only present when the participant's cursor is in the same view as the viewer (section 85: "cursor in same view"). */
  readonly cursor: { readonly x: number; readonly y: number } | null;
}

/** First-and-last-word initials (e.g. "Ada Lovelace" -> "AL"); a single word takes its first two characters; empty input is '?' rather than an empty string, so a UI always has something to render. */
export function deriveInitials(displayName: string): string {
  const words = displayName
    .trim()
    .split(/\s+/)
    .filter((word) => word.length > 0);
  const first = words[0];
  if (first === undefined) {
    return '?';
  }
  if (words.length === 1) {
    return first.slice(0, 2).toUpperCase();
  }
  const last = words[words.length - 1];
  if (last === undefined) {
    return first.charAt(0).toUpperCase();
  }
  return (first.charAt(0) + last.charAt(0)).toUpperCase();
}

/** A future lastActivityAtMs (clock skew) is treated as active rather than producing a negative-elapsed result. */
export function derivePresenceStatus(
  lastActivityAtMs: number,
  nowMs: number,
  idleThresholdMs: number = DEFAULT_IDLE_THRESHOLD_MS,
): PresenceStatus {
  const elapsedMs = nowMs - lastActivityAtMs;
  return elapsedMs >= idleThresholdMs ? 'idle' : 'active';
}

export interface BuildVisiblePresenceOptions {
  readonly viewerViewId: string;
  /** Excluded from the result - a viewer does not need its own presence reflected back at it. */
  readonly selfParticipantId: string;
  /**
   * Section 85's "selection where permitted": the actual permission
   * decision belongs to a server that does not exist in this repository
   * yet (security/THREAT-MODEL.md: "No permission system is implemented
   * yet"). This prototype's real, tested contribution is that the
   * client-side gate is correctly wired to hide selection whenever this
   * predicate says no - whatever later supplies a real authorization
   * decision only has to implement this one function correctly.
   */
  readonly isSelectionPermitted: (participantId: string) => boolean;
  readonly nowMs: number;
  readonly idleThresholdMs?: number;
}

/** Projects raw per-participant presence state into what a viewer is actually allowed to see: gates selection by permission and cursor by same-view, derives idle/active status, and excludes the viewer's own entry. */
export function buildVisiblePresence(
  states: ReadonlyMap<number, ParticipantPresenceState>,
  options: BuildVisiblePresenceOptions,
): readonly VisibleParticipantPresence[] {
  const results: VisibleParticipantPresence[] = [];
  for (const state of states.values()) {
    if (state.participantId === options.selfParticipantId) {
      continue;
    }
    const status = derivePresenceStatus(
      state.lastActivityAtMs,
      options.nowMs,
      options.idleThresholdMs,
    );
    const permitted = options.isSelectionPermitted(state.participantId);
    const cursor =
      state.cursor !== null && state.cursor.viewId === options.viewerViewId
        ? { x: state.cursor.x, y: state.cursor.y }
        : null;
    results.push({
      participantId: state.participantId,
      initials: state.initials,
      activeViewId: state.activeViewId,
      status,
      selection: permitted ? state.selection : [],
      cursor,
    });
  }
  return results;
}
