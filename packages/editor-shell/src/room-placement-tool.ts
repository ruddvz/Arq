/**
 * ARQ-112: implement room placement.
 *
 * Composes the command lifecycle (@arq/command-system, ARQ-038) with
 * traceRoomBoundary/polygonArea (@arq/geometry-2d, ARQ-111/ARQ-085)
 * into blueprint section 49's "First workflow": click within an
 * enclosed boundary, calculate polygon, show preview, assign name,
 * calculate area, display room label. "Display room label" is a
 * rendering concern and stays out of this module, same as every other
 * placement tool in this package.
 *
 * hover() is the live preview (traces the boundary continuously as the
 * cursor moves, before anything is committed); placeSeed() commits a
 * specific seed point as this placement's target, freezing its traced
 * boundary; setName() is the "assign name" step. "Calculate area" is
 * not a separate step the caller drives - it falls out of tracing the
 * boundary (polygonArea on the result), the same way an opening's
 * width/height fall out of the DoorType/WindowType a caller chose
 * rather than being computed here.
 *
 * Deliberately generic over the host wall edges' id type (TId), working
 * only with traceRoomBoundary's own RoomBoundaryEdge shape rather than
 * importing WallId/Wall/Room from @arq/bim-core - the same
 * domain-agnostic layering every other tool in this package
 * establishes (wall-draw-tool.ts, door-placement-tool.ts,
 * window-placement-tool.ts). Constructing a Room (createRoom,
 * ARQ-110) from this tool's RoomPlacement result is a one-level-up
 * caller's job.
 *
 * No numeric overlay here (ARQ-053): a room's name is free text, not a
 * distance/angle override, so this tool tracks a plain name string
 * instead of importing numeric-overlay.ts.
 *
 * Escape/Enter: the same three-tier rule as every other tool here,
 * adapted to this tool's own fields in place of a numeric-overlay
 * field - clear the typed name first, then clear the placed seed point/
 * boundary, then exit the tool. finish() (Enter) only returns a
 * RoomPlacement when a seed point was placed, its traced boundary's
 * status is 'valid' (not 'not-enclosed'/'invalid-polygon' - blueprint
 * section 49's own status list), and a non-empty name was assigned -
 * otherwise it commits nothing, so "invalid input leaves committed
 * project state unchanged" holds because there is nothing for a caller
 * to act on.
 */

import { createCommandLifecycle, type CommandLifecycleSnapshot } from '@arq/command-system';
import type { RoomBoundaryEdge, RoomBoundaryStatus, WorldPoint } from '@arq/geometry-2d';
import { polygonArea, traceRoomBoundary } from '@arq/geometry-2d';

export interface RoomPlacementPreview<TId> {
  readonly status: RoomBoundaryStatus;
  readonly boundary: readonly WorldPoint[];
  readonly boundaryEdgeIds: readonly TId[];
  readonly area: number;
}

export interface RoomPlacementToolSnapshot<TId> {
  readonly lifecycle: CommandLifecycleSnapshot;
  readonly seedPoint: WorldPoint | null;
  readonly preview: RoomPlacementPreview<TId> | null;
  readonly name: string;
}

export interface RoomPlacement<TId> {
  readonly seedPoint: WorldPoint;
  readonly boundary: readonly WorldPoint[];
  readonly boundaryEdgeIds: readonly TId[];
  readonly area: number;
  readonly name: string;
}

export function createRoomPlacementTool<TId>() {
  const lifecycle = createCommandLifecycle();
  let seedPoint: WorldPoint | null = null;
  let preview: RoomPlacementPreview<TId> | null = null;
  let name = '';

  function snapshot(): RoomPlacementToolSnapshot<TId> {
    return { lifecycle: lifecycle.snapshot(), seedPoint, preview, name };
  }

  /** Arms the tool for a fresh placement, resetting any previously chosen seed/boundary/name. */
  function arm(): RoomPlacementToolSnapshot<TId> {
    lifecycle.arm();
    seedPoint = null;
    preview = null;
    name = '';
    return snapshot();
  }

  function beginPreview(): RoomPlacementToolSnapshot<TId> {
    lifecycle.beginPreview();
    return snapshot();
  }

  /**
   * Live preview: traces the boundary that would result from placing
   * the seed at `cursor` right now - read-only, does not change the
   * tool's committed state. `area` is 0 for a non-'valid' status, since
   * there is no meaningful enclosed polygon to measure.
   */
  function hover(
    edges: readonly RoomBoundaryEdge<TId>[],
    cursor: WorldPoint,
    tolerance: number,
  ): RoomPlacementPreview<TId> {
    const traced = traceRoomBoundary(edges, cursor, tolerance);
    return {
      status: traced.status,
      boundary: traced.boundary,
      boundaryEdgeIds: traced.boundaryEdgeIds,
      area: traced.status === 'valid' ? polygonArea(traced.boundary) : 0,
    };
  }

  /** Commits `point` as this placement's seed, freezing its traced boundary as the chosen target. */
  function placeSeed(
    edges: readonly RoomBoundaryEdge<TId>[],
    point: WorldPoint,
    tolerance: number,
  ): RoomPlacementToolSnapshot<TId> {
    if (lifecycle.snapshot().state !== 'previewing') {
      return snapshot();
    }
    seedPoint = point;
    preview = hover(edges, point, tolerance);
    lifecycle.placeSegment();
    return snapshot();
  }

  /** The "assign name" step: sets the room's name to `newName` (replacing, not appending, any previously typed name). */
  function setName(newName: string): RoomPlacementToolSnapshot<TId> {
    name = newName;
    return snapshot();
  }

  /**
   * Finishes placement: valid only when a seed point was placed, its
   * traced boundary is 'valid', and a non-empty name was assigned. An
   * invalid or not-yet-placed attempt commits nothing and returns null.
   */
  function finish(): RoomPlacement<TId> | null {
    const isValid =
      seedPoint !== null && preview !== null && preview.status === 'valid' && name.trim().length > 0;
    lifecycle.commit(isValid);
    if (!isValid || seedPoint === null || preview === null) {
      return null;
    }
    return {
      seedPoint,
      boundary: preview.boundary,
      boundaryEdgeIds: preview.boundaryEdgeIds,
      area: preview.area,
      name,
    };
  }

  /**
   * The three-tier Escape: clear the typed name first, stopping there
   * for this press; only once the name is already empty does a press
   * fall through to clear the placed seed/boundary, then (a further
   * press) exit the tool.
   */
  function escape(): RoomPlacementToolSnapshot<TId> {
    if (name !== '') {
      name = '';
      return snapshot();
    }
    const beforeCount = lifecycle.snapshot().segmentCount;
    lifecycle.escape();
    const afterCount = lifecycle.snapshot().segmentCount;
    if (afterCount < beforeCount) {
      seedPoint = null;
      preview = null;
    }
    return snapshot();
  }

  return { snapshot, arm, beginPreview, hover, placeSeed, setName, finish, escape };
}
