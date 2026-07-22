/**
 * ARQ-094: implement wall drawing tool.
 *
 * Composes the already-built command lifecycle (@arq/command-system,
 * ARQ-038) and numeric overlay (numeric-overlay.ts, ARQ-053) into
 * blueprint section 45's "First wall tool" sequence: place start,
 * preview, type distance or place end, continue chain or finish. Steps
 * 1-2 of that sequence ("choose type", "choose alignment") and the
 * eventual Wall creation are deliberately NOT built here: this tool
 * only manages the *interaction* (a chain of placed points plus
 * numeric-override state) and hands back plain segments
 * (WallDrawSegment: start/end WorldPoint) on finish - attaching a
 * WallTypeId/LevelId/alignment and actually constructing Wall instances
 * (via createWall, ARQ-092, and applyCreateElement, ARQ-067) is a
 * one-level-up caller's job, the same way hit-test.ts and
 * selection-filter.ts stay domain-agnostic rather than importing
 * bim-core.
 *
 * "Preview joins" and "validate" (steps 7-8) are also not implemented
 * here: join resolution (butt/mitre/T, ARQ-095/096/097) operates on the
 * full set of walls in a project, which this single in-progress tool
 * has no access to - it is the caller's job to run join resolution
 * against the segments this tool produces once they're actually
 * committed as Wall instances.
 *
 * Escape/Enter, concretely: Escape follows command-lifecycle's exact
 * three-tier rule (clear the numeric overlay field first; then cancel
 * the most recently placed point; then exit the tool) - tracked by
 * comparing the lifecycle's segmentCount before and after calling its
 * escape(), popping a point only when a segment was actually cancelled.
 * Enter (finish()) commits only when at least one segment exists
 * ("commits only a valid preview", ARQ-038); a tool armed and then
 * immediately finished with nothing placed commits nothing and returns
 * an empty array - "invalid input leaves committed project state
 * unchanged" is upheld by never returning segments for the caller to
 * act on in that case.
 */

import { createCommandLifecycle, type CommandLifecycleSnapshot } from '@arq/command-system';
import type { WorldPoint } from '@arq/geometry-2d';
import {
  createNumericOverlay,
  parseNumericOverlay,
  resolveNumericOverlayPoint,
  type NumericOverlayState,
} from './numeric-overlay';

export interface WallDrawSegment {
  readonly start: WorldPoint;
  readonly end: WorldPoint;
}

export interface WallDrawToolSnapshot {
  readonly lifecycle: CommandLifecycleSnapshot;
  readonly overlay: NumericOverlayState;
  readonly points: readonly WorldPoint[];
}

export function createWallDrawTool() {
  const lifecycle = createCommandLifecycle();
  const overlay = createNumericOverlay();
  let points: WorldPoint[] = [];

  function snapshot(): WallDrawToolSnapshot {
    return { lifecycle: lifecycle.snapshot(), overlay: overlay.snapshot(), points: [...points] };
  }

  /** Step 1-2 (choose type/alignment) happen before this: arms the tool for a fresh chain. */
  function arm(): WallDrawToolSnapshot {
    lifecycle.arm();
    points = [];
    return snapshot();
  }

  /** Step 4 (preview): pointer movement while awaiting the next point. */
  function beginPreview(): WallDrawToolSnapshot {
    lifecycle.beginPreview();
    return snapshot();
  }

  /**
   * Resolves the point that would be placed right now, given the raw
   * cursor-derived distance/angle and any numeric-overlay override -
   * used to render the live preview segment before the user commits to
   * a point.
   */
  function previewPoint(fallbackDistance: number, fallbackAngleRadians: number): WorldPoint | null {
    const state = lifecycle.snapshot();
    if (state.state !== 'previewing' || points.length === 0) {
      return null;
    }
    const from = points[points.length - 1]!;
    const parsed = parseNumericOverlay(overlay.snapshot());
    return resolveNumericOverlayPoint(parsed, from, fallbackDistance, fallbackAngleRadians);
  }

  /** Step 3/5 (place start, or place end / continue chain): commits `point` as the next vertex. */
  function placePoint(point: WorldPoint): WallDrawToolSnapshot {
    if (lifecycle.snapshot().state !== 'previewing') {
      return snapshot();
    }
    points.push(point);
    overlay.reset();
    lifecycle.placeSegment();
    return snapshot();
  }

  /** Step 6 (finish): ends the chain, returning the segments between consecutive placed points. Empty if fewer than two points were placed. */
  function finish(): readonly WallDrawSegment[] {
    const segments: WallDrawSegment[] = [];
    for (let i = 0; i < points.length - 1; i += 1) {
      segments.push({ start: points[i]!, end: points[i + 1]! });
    }
    lifecycle.commit(segments.length > 0);
    return segments;
  }

  /**
   * The three-tier Escape: clear a pending overlay field first, stopping
   * there for this press; only once there is no pending field text does
   * a press fall through to cancel the last point, then (a further
   * press) exit the tool.
   */
  function escape(): WallDrawToolSnapshot {
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
      points.pop();
    }
    return snapshot();
  }

  return { snapshot, arm, beginPreview, previewPoint, placePoint, finish, escape, overlay };
}
