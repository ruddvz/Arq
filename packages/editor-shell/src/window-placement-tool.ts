/**
 * ARQ-108: implement window placement.
 *
 * The window counterpart to door-placement-tool.ts (ARQ-105): composes
 * the command lifecycle (@arq/command-system, ARQ-038) and the numeric
 * overlay (numeric-overlay.ts, ARQ-053) into the same host preview /
 * offset dimension / flip side interactions, since blueprint section
 * 47 states windows' "interactions match doors where meaningful" - host
 * preview, offset dimension, and flip side all carry over unchanged.
 * flip *hand* and swing angle do not: a window has no hinge, so this
 * tool tracks only `side`, not `hand`.
 *
 * This intentionally duplicates door-placement-tool.ts's host/offset/
 * escape-tier structure rather than factoring out a shared base: the
 * two tools differ only in the hand/swingAngle fields door tracks and
 * window does not, and door-placement-tool.ts is already shipped,
 * tested, and closed under ARQ-105 - restructuring it to share code
 * with a new, unrelated issue's tool risks regressing settled behaviour
 * for a marginal DRY gain. If a third opening-hosted element ever needs
 * this same host-preview/offset/escape shape, that is the point to
 * extract a shared base, not before.
 *
 * Same domain-agnostic layering as door-placement-tool.ts: generic over
 * the host wall's id type (TId), working only with a SegmentCandidate-
 * based host, never importing WallId/Wall/Window from @arq/bim-core.
 * WindowPlacementSide is redeclared locally rather than imported, for
 * the same reason.
 *
 * Out of scope, and why: constructing an Opening/Window
 * (createOpening/createWindow, ARQ-103/107) is a one-level-up caller's
 * job, since width/height/sillHeight come from a WindowType this tool
 * has no notion of - mirroring how door-placement-tool.ts leaves
 * Opening/Door construction to its own caller.
 *
 * Escape/Enter: identical three-tier rule to door-placement-tool.ts
 * (clear the overlay's pending field text; then clear the chosen
 * host/offset; then exit the tool). finish() (Enter) only returns a
 * WindowPlacement when a host was chosen and the resolved offset lies
 * within that host's own centerline length (blueprint section 48's
 * "opening cannot extend beyond host" - the one part of that rule
 * checkable from the host's own geometry alone; the height rule needs a
 * WindowType/WallType this tool never sees, and stays the caller's
 * job) - otherwise it commits nothing, so "invalid input leaves
 * committed project state unchanged" holds because there is nothing
 * for a caller to act on.
 */

import { createCommandLifecycle, type CommandLifecycleSnapshot } from '@arq/command-system';
import type { Viewport, WorldPoint } from '@arq/geometry-2d';
import { closestPointOnSegment, vectorBetween, vectorLength } from '@arq/geometry-2d';
import {
  createNumericOverlay,
  parseNumericOverlay,
  type NumericOverlayState,
} from './numeric-overlay';
import type { SegmentCandidate } from './segment-candidate';

export type WindowPlacementSide = 'left' | 'right';

export interface WindowHostCandidate<TId> extends SegmentCandidate {
  readonly id: TId;
}

/** What hover() finds: the nearest host and the point on its centerline the window would sit at - a read-only preview, nothing is committed yet. */
export interface WindowHostPreview<TId> {
  readonly hostId: TId;
  readonly point: WorldPoint;
  readonly offsetFromWallStart: number;
}

export interface WindowPlacementToolSnapshot<TId> {
  readonly lifecycle: CommandLifecycleSnapshot;
  readonly overlay: NumericOverlayState;
  readonly hostId: TId | null;
  readonly offsetFromWallStart: number | null;
  readonly side: WindowPlacementSide;
}

export interface WindowPlacement<TId> {
  readonly hostId: TId;
  readonly offsetFromWallStart: number;
  readonly side: WindowPlacementSide;
}

export function createWindowPlacementTool<TId>() {
  const lifecycle = createCommandLifecycle();
  const overlay = createNumericOverlay();
  let hostId: TId | null = null;
  let hostLength = 0;
  let offsetFromWallStart: number | null = null;
  let side: WindowPlacementSide = 'right';

  function snapshot(): WindowPlacementToolSnapshot<TId> {
    return {
      lifecycle: lifecycle.snapshot(),
      overlay: overlay.snapshot(),
      hostId,
      offsetFromWallStart,
      side,
    };
  }

  /** Arms the tool for a fresh placement, resetting any previously chosen host/offset/side. */
  function arm(): WindowPlacementToolSnapshot<TId> {
    lifecycle.arm();
    hostId = null;
    hostLength = 0;
    offsetFromWallStart = null;
    side = 'right';
    return snapshot();
  }

  function beginPreview(): WindowPlacementToolSnapshot<TId> {
    lifecycle.beginPreview();
    return snapshot();
  }

  /**
   * Host preview: the nearest host candidate to the cursor within
   * tolerance, and the point on its centerline the window would sit at
   * - read-only, does not change the tool's committed state. Returns
   * null when nothing is within tolerance (no host under the cursor).
   */
  function hover(
    candidates: readonly WindowHostCandidate<TId>[],
    cursor: WorldPoint,
    viewport: Viewport,
    toleranceScreenPx = 6,
  ): WindowHostPreview<TId> | null {
    const toleranceWorld = toleranceScreenPx / viewport.pixelsPerUnit;
    let best: WindowHostPreview<TId> | null = null;
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
   * door-placement-tool.ts's placeOnHost has with its fallback offset.
   */
  function placeOnHost(
    candidate: WindowHostCandidate<TId>,
    rawOffsetFromWallStart: number,
  ): WindowPlacementToolSnapshot<TId> {
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

  /** Section 47's "flip side" (matching doors where meaningful): toggles which face of the host the window faces. */
  function flipSide(): WindowPlacementToolSnapshot<TId> {
    side = side === 'left' ? 'right' : 'left';
    return snapshot();
  }

  /**
   * Finishes placement: valid only when a host was chosen and the
   * offset lies within [0, host length] - see this module's doc
   * comment for why only this one structural check happens here. An
   * invalid or not-yet-placed attempt commits nothing and returns null.
   */
  function finish(): WindowPlacement<TId> | null {
    const isValid =
      hostId !== null &&
      offsetFromWallStart !== null &&
      offsetFromWallStart >= 0 &&
      offsetFromWallStart <= hostLength;
    lifecycle.commit(isValid);
    if (!isValid || hostId === null || offsetFromWallStart === null) {
      return null;
    }
    return { hostId, offsetFromWallStart, side };
  }

  /**
   * The three-tier Escape: clear a pending overlay field first, stopping
   * there for this press; only once there is no pending field text does
   * a press fall through to clear the chosen host/offset, then (a
   * further press) exit the tool.
   */
  function escape(): WindowPlacementToolSnapshot<TId> {
    const overlayBefore = overlay.snapshot();
    const hasPendingFieldText =
      overlayBefore.field !== null &&
      (overlayBefore.field === 'distance'
        ? overlayBefore.distanceText
        : overlayBefore.angleText) !== '';
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

  return { snapshot, arm, beginPreview, hover, placeOnHost, flipSide, finish, escape, overlay };
}
