/**
 * ARQ-105: implement door placement.
 *
 * Composes the command lifecycle (@arq/command-system, ARQ-038) and the
 * numeric overlay (numeric-overlay.ts, ARQ-053) into blueprint section
 * 46's door interactions that are purely about *where* a door goes:
 * host preview (hovering finds the nearest host wall candidate and the
 * point on its centerline the door would sit at), offset dimension
 * (typing a precise offset overrides the raw cursor-derived one, same
 * "dynamic input" pattern wall-draw-tool.ts, ARQ-094, already uses for
 * distance/angle - only the distance field is used here, since a door's
 * placement is a single scalar offset along its host, not a 2D point),
 * and flip side/flip hand (toggled live during placement, before the
 * door is actually committed to a project).
 *
 * Deliberately generic over the host wall's id type (TId) and working
 * only with DoorHostCandidate (a SegmentCandidate plus that id) rather
 * than importing WallId or Wall from @arq/bim-core - the same
 * domain-agnostic layering wall-draw-tool.ts, hit-test.ts, and
 * selection-filter.ts already establish. DoorPlacementSide/Hand are
 * redeclared locally (matching bim-core's Door.side/Door.hand exactly)
 * rather than imported, for the same reason.
 *
 * What this tool does NOT do, and why: it does not construct an Opening
 * or a Door (createOpening/createDoor, ARQ-103/104) - width, height,
 * and sillHeight come from a DoorType, a bim-core concept this tool has
 * no notion of; a one-level-up caller combines this tool's
 * DoorPlacement result with a chosen DoorType's defaults to actually
 * build the domain objects, exactly how a caller attaches a WallTypeId
 * to wall-draw-tool.ts's segments. It also does not implement resize,
 * move-along-host, or rehost (section 46's other interactions) - those
 * apply to an already-placed door and are separate future work, not
 * part of first placement.
 *
 * Escape/Enter: Escape follows the same three-tier rule as
 * wall-draw-tool.ts (clear the overlay's pending field text first; only
 * once there is none does a press clear the chosen host/offset, then
 * exit the tool) - tracked the same way, by comparing the lifecycle's
 * segmentCount before and after escape(). finish() (Enter) only returns
 * a DoorPlacement when a host was actually chosen AND the resolved
 * offset lies within that host's own centerline length (blueprint
 * section 48's "opening cannot extend beyond host", the one part of
 * that rule this tool can check with nothing but the host's own
 * geometry - the height rule needs a DoorType/WallType this tool never
 * sees, and is the caller's responsibility) - otherwise it commits
 * nothing, so "invalid input leaves committed project state unchanged"
 * holds because there is nothing for a caller to act on.
 */

import { createCommandLifecycle, type CommandLifecycleSnapshot } from '@arq/command-system';
import type { Viewport, WorldPoint } from '@arq/geometry-2d';
import { closestPointOnSegment, vectorBetween, vectorLength } from '@arq/geometry-2d';
import { createNumericOverlay, parseNumericOverlay, type NumericOverlayState } from './numeric-overlay';
import type { SegmentCandidate } from './segment-candidate';

export type DoorPlacementSide = 'left' | 'right';
export type DoorPlacementHand = 'left' | 'right';

export interface DoorHostCandidate<TId> extends SegmentCandidate {
  readonly id: TId;
}

/** What hover() finds: the nearest host and the point on its centerline the door would sit at - a read-only preview, nothing is committed yet. */
export interface DoorHostPreview<TId> {
  readonly hostId: TId;
  readonly point: WorldPoint;
  readonly offsetFromWallStart: number;
}

export interface DoorPlacementToolSnapshot<TId> {
  readonly lifecycle: CommandLifecycleSnapshot;
  readonly overlay: NumericOverlayState;
  readonly hostId: TId | null;
  readonly offsetFromWallStart: number | null;
  readonly side: DoorPlacementSide;
  readonly hand: DoorPlacementHand;
}

export interface DoorPlacement<TId> {
  readonly hostId: TId;
  readonly offsetFromWallStart: number;
  readonly side: DoorPlacementSide;
  readonly hand: DoorPlacementHand;
}

export function createDoorPlacementTool<TId>() {
  const lifecycle = createCommandLifecycle();
  const overlay = createNumericOverlay();
  let hostId: TId | null = null;
  let hostLength = 0;
  let offsetFromWallStart: number | null = null;
  let side: DoorPlacementSide = 'right';
  let hand: DoorPlacementHand = 'right';

  function snapshot(): DoorPlacementToolSnapshot<TId> {
    return {
      lifecycle: lifecycle.snapshot(),
      overlay: overlay.snapshot(),
      hostId,
      offsetFromWallStart,
      side,
      hand,
    };
  }

  /** Arms the tool for a fresh placement, resetting any previously chosen host/offset/side/hand. */
  function arm(): DoorPlacementToolSnapshot<TId> {
    lifecycle.arm();
    hostId = null;
    hostLength = 0;
    offsetFromWallStart = null;
    side = 'right';
    hand = 'right';
    return snapshot();
  }

  function beginPreview(): DoorPlacementToolSnapshot<TId> {
    lifecycle.beginPreview();
    return snapshot();
  }

  /**
   * Host preview: the nearest host candidate to the cursor within
   * tolerance, and the point on its centerline the door would sit at -
   * read-only, does not change the tool's committed state. Returns null
   * when nothing is within tolerance (no host under the cursor).
   */
  function hover(
    candidates: readonly DoorHostCandidate<TId>[],
    cursor: WorldPoint,
    viewport: Viewport,
    toleranceScreenPx = 6,
  ): DoorHostPreview<TId> | null {
    const toleranceWorld = toleranceScreenPx / viewport.pixelsPerUnit;
    let best: DoorHostPreview<TId> | null = null;
    let bestDistance = Number.POSITIVE_INFINITY;
    for (const candidate of candidates) {
      const point = closestPointOnSegment(candidate, cursor);
      const distance = Math.hypot(point.x - cursor.x, point.y - cursor.y);
      if (distance <= toleranceWorld && distance < bestDistance) {
        bestDistance = distance;
        best = {
          hostId: candidate.id,
          point,
          offsetFromWallStart: vectorLength(vectorBetween(candidate.start, point)),
        };
      }
    }
    return best;
  }

  /**
   * Commits a host preview as this placement's chosen target. A validly
   * typed numeric-overlay distance overrides `rawOffsetFromWallStart`
   * (the hover-derived offset), same override relationship
   * wall-draw-tool.ts's previewPoint has with its fallback distance.
   */
  function placeOnHost(
    candidate: DoorHostCandidate<TId>,
    rawOffsetFromWallStart: number,
  ): DoorPlacementToolSnapshot<TId> {
    if (lifecycle.snapshot().state !== 'previewing') {
      return snapshot();
    }
    hostId = candidate.id;
    hostLength = vectorLength(vectorBetween(candidate.start, candidate.end));
    const parsed = parseNumericOverlay(overlay.snapshot());
    offsetFromWallStart = parsed.distance ?? rawOffsetFromWallStart;
    overlay.reset();
    lifecycle.placeSegment();
    return snapshot();
  }

  /** Section 46's "flip side": toggles which face of the host the door swings toward. */
  function flipSide(): DoorPlacementToolSnapshot<TId> {
    side = side === 'left' ? 'right' : 'left';
    return snapshot();
  }

  /** Section 46's "flip hand": toggles which jamb the hinge is mounted on. */
  function flipHand(): DoorPlacementToolSnapshot<TId> {
    hand = hand === 'left' ? 'right' : 'left';
    return snapshot();
  }

  /**
   * Finishes placement: valid only when a host was chosen and the
   * offset lies within [0, host length] - see this module's doc comment
   * for why only this one structural check happens here. An invalid or
   * not-yet-placed attempt commits nothing and returns null.
   */
  function finish(): DoorPlacement<TId> | null {
    const isValid =
      hostId !== null &&
      offsetFromWallStart !== null &&
      offsetFromWallStart >= 0 &&
      offsetFromWallStart <= hostLength;
    lifecycle.commit(isValid);
    if (!isValid || hostId === null || offsetFromWallStart === null) {
      return null;
    }
    return { hostId, offsetFromWallStart, side, hand };
  }

  /**
   * The three-tier Escape: clear a pending overlay field first, stopping
   * there for this press; only once there is no pending field text does
   * a press fall through to clear the chosen host/offset, then (a
   * further press) exit the tool.
   */
  function escape(): DoorPlacementToolSnapshot<TId> {
    const overlayBefore = overlay.snapshot();
    const hasPendingFieldText =
      overlayBefore.field !== null &&
      (overlayBefore.field === 'distance' ? overlayBefore.distanceText : overlayBefore.angleText) !==
        '';
    if (hasPendingFieldText) {
      overlay.escape();
      return snapshot();
    }
    overlay.escape();
    const beforeCount = lifecycle.snapshot().segmentCount;
    lifecycle.escape();
    const afterCount = lifecycle.snapshot().segmentCount;
    if (afterCount < beforeCount) {
      hostId = null;
      offsetFromWallStart = null;
    }
    return snapshot();
  }

  return {
    snapshot,
    arm,
    beginPreview,
    hover,
    placeOnHost,
    flipSide,
    flipHand,
    finish,
    escape,
    overlay,
  };
}
