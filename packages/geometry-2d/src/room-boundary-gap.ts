/**
 * ARQ-113 (geometry half): find the nearest gap in a wall network that
 * is preventing a room boundary from closing - blueprint section 49's
 * "Room error UX": "boundary highlight; nearest gap; distance of gap;
 * suggested wall endpoint; 'Zoom to gap' action."
 *
 * A "gap" here is a dangling wall endpoint (a vertex, after merging
 * within tolerance the same way room-boundary-graph.ts does, touched by
 * only one edge) and the nearest point - another dangling endpoint, or
 * the nearest point on any wall it is not already part of - that
 * closing it would connect to. That candidate point is exactly the
 * blueprint's "suggested wall endpoint"; the distance between the two
 * is "distance of gap."
 *
 * Returns null when there is no dangling endpoint at all (every vertex
 * has degree >= 2) - a network with no loose ends cannot have this
 * kind of gap; if a seed point still fails to enclose in that case, the
 * cause is not a broken network (it is the caller's job to fall back to
 * a plain "not enclosed" message rather than a gap suggestion).
 *
 * Deliberately does not restrict the search to the vicinity of any
 * particular seed point: with only a handful of walls forming a room,
 * the single nearest gap across the whole network is, in practice,
 * almost always the relevant one, and adding a "how close to the seed"
 * radius parameter here would be an unrequested, unvalidated behaviour
 * (this issue's non-goal: don't expand into later release scope) - a
 * caller with a large multi-room project needing a localised search can
 * pre-filter `edges` to a relevant neighbourhood before calling this.
 */

import { pointsAreCoincident } from './tolerance';
import { closestPointOnSegment } from './nearest-point';
import type { WorldPoint } from './coordinate-system';
import type { RoomBoundaryEdge } from './room-boundary-graph';

export interface RoomBoundaryGap {
  readonly from: WorldPoint;
  readonly to: WorldPoint;
  readonly distance: number;
}

function clusterVertices<TId>(
  edges: readonly RoomBoundaryEdge<TId>[],
  tolerance: number,
): { readonly points: WorldPoint[]; readonly degree: number[]; readonly pairs: readonly (readonly [number, number])[] } {
  const points: WorldPoint[] = [];
  const degree: number[] = [];
  const pairs: (readonly [number, number])[] = [];

  function indexFor(point: WorldPoint): number {
    for (let i = 0; i < points.length; i += 1) {
      if (pointsAreCoincident(points[i]!, point, tolerance)) {
        return i;
      }
    }
    points.push(point);
    degree.push(0);
    return points.length - 1;
  }

  for (const edge of edges) {
    if (pointsAreCoincident(edge.start, edge.end, tolerance)) {
      continue; // degenerate zero-length edge - cannot contribute a connection
    }
    const a = indexFor(edge.start);
    const b = indexFor(edge.end);
    if (a === b) {
      continue;
    }
    degree[a] = (degree[a] ?? 0) + 1;
    degree[b] = (degree[b] ?? 0) + 1;
    pairs.push([a, b]);
  }

  return { points, degree, pairs };
}

/**
 * The single nearest gap across the whole network - see this module's
 * doc comment for exactly what "gap" means here. Null when there is no
 * dangling endpoint, or when `tolerance` is invalid (never a hidden
 * fallback epsilon, per ARQ-081).
 */
export function findNearestRoomBoundaryGap<TId>(
  edges: readonly RoomBoundaryEdge<TId>[],
  tolerance: number,
): RoomBoundaryGap | null {
  if (!Number.isFinite(tolerance) || tolerance < 0) {
    return null;
  }

  const { points, degree, pairs } = clusterVertices(edges, tolerance);
  const danglingIndices: number[] = [];
  for (let i = 0; i < points.length; i += 1) {
    if (degree[i] === 1) {
      danglingIndices.push(i);
    }
  }
  if (danglingIndices.length === 0) {
    return null;
  }

  const neighborsOf: Set<number>[] = points.map(() => new Set<number>());
  for (const [a, b] of pairs) {
    neighborsOf[a]!.add(b);
    neighborsOf[b]!.add(a);
  }

  let best: RoomBoundaryGap | null = null;

  function consider(from: WorldPoint, to: WorldPoint): void {
    const distance = Math.hypot(to.x - from.x, to.y - from.y);
    if (!best || distance < best.distance) {
      best = { from, to, distance };
    }
  }

  for (const i of danglingIndices) {
    const from = points[i]!;
    for (let j = 0; j < points.length; j += 1) {
      if (j === i || neighborsOf[i]!.has(j)) {
        continue; // skip itself and vertices already directly connected to it
      }
      consider(from, points[j]!);
    }
    for (const [a, b] of pairs) {
      if (a === i || b === i) {
        continue; // skip edges this dangling vertex is already part of
      }
      consider(from, closestPointOnSegment({ start: points[a]!, end: points[b]! }, from));
    }
  }

  return best;
}
