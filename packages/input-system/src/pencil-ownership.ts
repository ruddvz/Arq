import { classifyPointerInputRole, type PointerInputRole } from './pointer-role';

/**
 * V3-145: which input owns a gesture when more than one is touching the screen.
 *
 * `pointer-role.ts` answers what an input *is* and what it is allowed to do.
 * The harder question on a tablet is what happens when two arrive at once, and
 * the honest answer is that it happens constantly rather than rarely: a hand
 * rests on the glass while the Pencil draws, a second finger lands to pan
 * while a wall is half-drawn, a palm brushes the canvas at the end of a stroke.
 *
 * The rule is that the Pencil wins, and it wins in a specific way. Once a
 * pencil pointer is drawing, touch pointers are not "ignored" - they are
 * classified as palm and never reach the tool. Ignoring them silently would be
 * indistinguishable from a dropped event, and the difference matters when the
 * touch was a deliberate second finger the user expected to pan with.
 *
 * The subtle part is release order. A palm usually lifts *after* the Pencil,
 * so a naive "last pointer up ends the gesture" ends the stroke on the palm's
 * release, at the palm's position - which draws a wall to the user's wrist.
 * Ownership therefore ends when the owning pointer lifts, and later releases
 * from rejected pointers change nothing.
 *
 * A finger is a legitimate primary input when no Pencil is present. This does
 * not privilege a stylus over people who do not use one; it resolves a
 * conflict that only exists while both are down.
 */

export type GestureOwner =
  | { readonly kind: 'none' }
  | {
      readonly kind: 'owned';
      readonly pointerId: number;
      readonly role: PointerInputRole;
    };

export type PointerDisposition =
  /** This pointer owns the gesture; its events reach the tool. */
  | 'owns'
  /** A pointer rejected because the Pencil owns the gesture. Reported, never silently dropped. */
  | 'palm-rejected'
  /** A second pointer of the same kind, e.g. a two-finger pan while one finger draws. */
  | 'secondary'
  /** A pointer whose release is being observed after it was already rejected. */
  | 'ignored-release';

export interface PointerEventSample {
  readonly pointerId: number;
  readonly pointerType: string;
  readonly phase: 'down' | 'move' | 'up' | 'cancel';
}

export interface PointerDecision {
  readonly disposition: PointerDisposition;
  readonly owner: GestureOwner;
  /** True when this event ended the gesture, so the caller commits or cancels exactly once. */
  readonly endsGesture: boolean;
}

export const NO_OWNER: GestureOwner = { kind: 'none' };

/**
 * Tracks gesture ownership across concurrent pointers.
 *
 * Stateful because the question is inherently about history: whether a pointer
 * may draw depends on what was already down when it arrived, and a pure
 * function over one event cannot know that.
 */
export function createPencilOwnershipTracker() {
  let owner: GestureOwner = NO_OWNER;
  const rejected = new Set<number>();

  function currentOwner(): GestureOwner {
    return owner;
  }

  function handle(sample: PointerEventSample): PointerDecision {
    const role = classifyPointerInputRole(sample.pointerType);

    if (sample.phase === 'down') {
      if (owner.kind === 'none') {
        owner = { kind: 'owned', pointerId: sample.pointerId, role };
        return { disposition: 'owns', owner, endsGesture: false };
      }

      // A Pencil arriving mid-gesture takes over from a finger: someone who
      // starts with a finger and then picks up the Pencil means the Pencil.
      if (role === 'pencil' && owner.role !== 'pencil') {
        rejected.add(owner.pointerId);
        owner = { kind: 'owned', pointerId: sample.pointerId, role };
        return { disposition: 'owns', owner, endsGesture: false };
      }

      if (owner.role === 'pencil' && role !== 'pencil') {
        rejected.add(sample.pointerId);
        return { disposition: 'palm-rejected', owner, endsGesture: false };
      }

      // Same class of input, both legitimate: a second finger while a finger
      // draws is a pan, not a palm.
      rejected.add(sample.pointerId);
      return { disposition: 'secondary', owner, endsGesture: false };
    }

    if (owner.kind === 'owned' && sample.pointerId === owner.pointerId) {
      if (sample.phase === 'up' || sample.phase === 'cancel') {
        owner = NO_OWNER;
        rejected.clear();
        return { disposition: 'owns', owner, endsGesture: true };
      }
      return { disposition: 'owns', owner, endsGesture: false };
    }

    if (rejected.has(sample.pointerId)) {
      if (sample.phase === 'up' || sample.phase === 'cancel') {
        rejected.delete(sample.pointerId);
      }
      // The release that would otherwise end the stroke at the user's wrist.
      return { disposition: 'ignored-release', owner, endsGesture: false };
    }

    // A move or release for a pointer never seen going down: not this
    // gesture's, and not something to guess about.
    return { disposition: 'ignored-release', owner, endsGesture: false };
  }

  /** Drops all state, for a tool cancel or a lost pointer capture. */
  function reset(): void {
    owner = NO_OWNER;
    rejected.clear();
  }

  return { handle, currentOwner, reset, rejectedCount: () => rejected.size };
}

export type PencilOwnershipTracker = ReturnType<typeof createPencilOwnershipTracker>;

/**
 * Whether a disposition should reach the drawing tool.
 *
 * A single place, so a caller cannot handle three of the four cases and let the
 * fourth through. `secondary` is deliberately excluded: a second finger is a
 * viewport gesture, and routing it to the tool is how a pan becomes a wall.
 */
export function reachesTool(disposition: PointerDisposition): boolean {
  return disposition === 'owns';
}

/**
 * Whether a disposition should reach the viewport as a pan or zoom.
 *
 * `secondary` only. A rejected palm must not pan either - the canvas sliding
 * under a resting hand is the same failure as the wall being drawn to it.
 */
export function reachesViewport(disposition: PointerDisposition): boolean {
  return disposition === 'secondary';
}
