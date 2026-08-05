import type { WorldPoint } from './coordinate-system';
import type { RoomBoundaryEdge } from './room-boundary-graph';

/**
 * V3-104: recompute only the room boundaries an edit can have affected.
 *
 * `traceRoomBoundary` (ARQ-111) answers "what encloses this seed point" for one
 * room, by building a graph of every edge it is given. Re-running it for every
 * room in a project after every edit is correct and unusable: the work grows
 * with the size of the model rather than with the size of the change, so the
 * hundredth wall in a building takes longer to draw than the first, for reasons
 * the user cannot see and did not cause.
 *
 * The bound has to be conservative in one direction only. Recomputing a room
 * that did not change costs time; *not* recomputing one that did leaves a stale
 * boundary and a stale area on a drawing that will be issued, so the rule here
 * is only ever allowed to over-select. Two things put a room in the set:
 *
 * 1. It is built on an edge that changed or disappeared. Certain, not a
 *    heuristic - the boundary is literally made of that edge.
 * 2. A changed edge overlaps its extent. A wall drawn inside a room can split
 *    it, and one drawn across its doorway can close it, and neither of those
 *    rooms references the new edge yet - they cannot, it did not exist when
 *    they were traced. Extent overlap is what catches those without walking the
 *    whole graph.
 *
 * A wall drawn entirely outside a room's extent cannot change that room's
 * boundary: every edge of the boundary lies within the extent, and a segment
 * with no point inside it cannot join, cross or close any of them. That is what
 * makes the exclusion sound rather than merely plausible.
 */

export interface Extent {
  readonly minX: number;
  readonly minY: number;
  readonly maxX: number;
  readonly maxY: number;
}

export interface TracedRoom<TRoomId, TEdgeId> {
  readonly roomId: TRoomId;
  readonly seedPoint: WorldPoint;
  /** The edge ids the room's current boundary was traced from. */
  readonly boundaryEdgeIds: readonly TEdgeId[];
  /** The boundary as last traced. Empty for a room that has never traced successfully. */
  readonly boundary: readonly WorldPoint[];
}

export interface BoundaryEdgeChange<TEdgeId> {
  readonly edgeId: TEdgeId;
  readonly kind: 'added' | 'moved' | 'removed';
  /**
   * Where the edge was and/or is. A move contributes both positions, since a
   * wall dragged out of one room and into another affects both.
   */
  readonly extent: Extent;
}

export function extentOfPoints(points: readonly WorldPoint[]): Extent | null {
  if (points.length === 0) {
    return null;
  }
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  for (const point of points) {
    minX = Math.min(minX, point.x);
    minY = Math.min(minY, point.y);
    maxX = Math.max(maxX, point.x);
    maxY = Math.max(maxY, point.y);
  }
  return { minX, minY, maxX, maxY };
}

export function extentOfEdge<TId>(edge: RoomBoundaryEdge<TId>): Extent {
  return {
    minX: Math.min(edge.start.x, edge.end.x),
    minY: Math.min(edge.start.y, edge.end.y),
    maxX: Math.max(edge.start.x, edge.end.x),
    maxY: Math.max(edge.start.y, edge.end.y),
  };
}

/** Grown by `margin` on every side, so an edge that lands just outside a boundary still counts. */
export function extentsOverlap(a: Extent, b: Extent, margin: number): boolean {
  return (
    a.minX - margin <= b.maxX &&
    a.maxX + margin >= b.minX &&
    a.minY - margin <= b.maxY &&
    a.maxY + margin >= b.minY
  );
}

export type RoomAffectedReason = 'boundary-edge-changed' | 'change-within-extent' | 'never-traced';

export interface AffectedRoom<TRoomId> {
  readonly roomId: TRoomId;
  readonly reason: RoomAffectedReason;
}

/**
 * The rooms that must be retraced after a set of edge changes.
 *
 * `margin` is required rather than defaulted, per ARQ-081. It should be the
 * same tolerance the trace itself will use: an edge that lands within tolerance
 * of a boundary is one the trace may well join to, so excluding it here would
 * make this bound disagree with the thing it is bounding.
 *
 * A room whose boundary has never been traced is always included. It has no
 * edge ids and no extent to test against, and treating "no evidence" as "not
 * affected" is how a room that never computed stays never computed.
 */
export function roomsAffectedByEdgeChanges<TRoomId, TEdgeId>(
  rooms: readonly TracedRoom<TRoomId, TEdgeId>[],
  changes: readonly BoundaryEdgeChange<TEdgeId>[],
  margin: number,
): readonly AffectedRoom<TRoomId>[] {
  if (changes.length === 0) {
    return [];
  }

  const changedEdgeIds = new Set(changes.map((change) => change.edgeId));
  const affected: AffectedRoom<TRoomId>[] = [];

  for (const room of rooms) {
    if (room.boundary.length === 0) {
      affected.push({ roomId: room.roomId, reason: 'never-traced' });
      continue;
    }

    if (room.boundaryEdgeIds.some((edgeId) => changedEdgeIds.has(edgeId))) {
      affected.push({ roomId: room.roomId, reason: 'boundary-edge-changed' });
      continue;
    }

    const roomExtent = extentOfPoints(room.boundary);
    if (roomExtent === null) {
      affected.push({ roomId: room.roomId, reason: 'never-traced' });
      continue;
    }

    if (changes.some((change) => extentsOverlap(roomExtent, change.extent, margin))) {
      affected.push({ roomId: room.roomId, reason: 'change-within-extent' });
    }
  }

  return affected;
}

/**
 * The edges a room's retrace has to consider.
 *
 * Narrowing the *input* as well as the room set is the other half of the bound:
 * tracing one small room against every wall in a tower still walks the whole
 * model. Only edges whose extent meets the room's search extent can take part
 * in a face that contains the seed point, since a face is a closed loop of
 * edges and a loop cannot reach an edge that never comes near it.
 *
 * The search extent is the room's own extent grown by the changes that touched
 * it, because a wall removed from the room's perimeter can open it into
 * neighbouring space the old extent never covered.
 */
export function edgesForRetrace<TEdgeId>(
  edges: readonly RoomBoundaryEdge<TEdgeId>[],
  searchExtent: Extent,
  margin: number,
): readonly RoomBoundaryEdge<TEdgeId>[] {
  return edges.filter((edge) => extentsOverlap(extentOfEdge(edge), searchExtent, margin));
}

/** Unions two extents. Returns `b` when `a` is null, so a fold over changes needs no special first case. */
export function unionExtents(a: Extent | null, b: Extent): Extent {
  if (a === null) {
    return b;
  }
  return {
    minX: Math.min(a.minX, b.minX),
    minY: Math.min(a.minY, b.minY),
    maxX: Math.max(a.maxX, b.maxX),
    maxY: Math.max(a.maxY, b.maxY),
  };
}

/**
 * The extent a room should be retraced against: its own, plus every change that
 * put it in the affected set.
 */
export function retraceSearchExtent<TRoomId, TEdgeId>(
  room: TracedRoom<TRoomId, TEdgeId>,
  changes: readonly BoundaryEdgeChange<TEdgeId>[],
  margin: number,
): Extent | null {
  const own = extentOfPoints(room.boundary);
  const changedEdgeIds = new Set(room.boundaryEdgeIds);
  let extent = own;
  for (const change of changes) {
    const touchesRoom =
      changedEdgeIds.has(change.edgeId) ||
      (own !== null && extentsOverlap(own, change.extent, margin));
    if (touchesRoom) {
      extent = unionExtents(extent, change.extent);
    }
  }
  return extent;
}
