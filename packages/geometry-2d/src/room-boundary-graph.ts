/**
 * ARQ-111: implement room boundary graph.
 *
 * Blueprint section 49's "First workflow" (click within an enclosed
 * boundary; calculate polygon) and "Boundary sources" (room-bounding
 * wall faces) need a way to turn a network of wall segments into the
 * one smallest enclosed polygon surrounding a seed point - this module
 * is that algorithm, kept purely geometric (no Wall/WallType, generic
 * over a caller-supplied edge id) so room.ts (ARQ-110) and bim-core
 * generally can build on it without this module depending on bim-core.
 *
 * Takes plain centerline segments, not face lines: the exact
 * "room-bounding wall faces" refinement (offsetting each bounding
 * wall's centerline to whichever face - wall-face-line.ts, ARQ-093 -
 * actually faces the room) is left to a caller, since this function
 * does not know or care what a Segment's endpoints represent - a
 * caller can pass wall face lines instead of centerlines and get the
 * same trace, more precisely bounded. Centerlines are a real, working
 * first approximation, consistent with ADR-0007's "purpose-built,
 * start simple" direction for the first wall/room system.
 *
 * Algorithm: builds a half-edge graph from the input edges (vertices
 * merged within tolerance, per ARQ-081's tolerance policy -
 * pointsAreCoincident), then traces every face of the resulting planar
 * subdivision using the standard "next = smallest clockwise turn from
 * the reversed incoming edge" rule (de Berg et al., "Computational
 * Geometry", ch. 2's DCEL face-finding technique) - this always yields
 * a closed loop bounding the region immediately to one consistent side
 * of the trace direction, letting every bounded face be enumerated by
 * walking every half-edge exactly once. The one face with a negative
 * signed area is the unbounded outer face and is excluded; among the
 * remaining (positive-area) bounded faces, pointInPolygon (this
 * package) finds which ones actually contain the seed point, and the
 * smallest by area is the answer - in a planar subdivision the bounded
 * faces partition the plane without overlap, so "smallest containing"
 * is a defensive tie-break, not usually a real choice among several.
 *
 * Explicit tolerance, per ARQ-081: every vertex-merge and area/parity
 * comparison here takes `tolerance` as a required parameter, never a
 * hidden default - an invalid (negative or non-finite) tolerance
 * returns 'invalid-polygon' immediately rather than silently using
 * some fallback epsilon.
 *
 * Known limitation, honestly scoped out: "room containing island"
 * (section 42) - a polygon with a hole - is a multi-ring concept
 * pointInPolygon/polygon-area.ts do not model, so a room whose
 * boundary should exclude an interior island is not handled by this
 * first cut.
 */

import { pointsAreCoincident } from './tolerance';
import { signedArea } from './polygon-area';
import { pointInPolygon } from './point-in-polygon';
import type { WorldPoint } from './coordinate-system';
import type { Segment } from './segment';

export interface RoomBoundaryEdge<TId> extends Segment {
  readonly id: TId;
}

export type RoomBoundaryStatus = 'valid' | 'not-enclosed' | 'invalid-polygon';

export interface RoomBoundaryResult<TId> {
  readonly status: RoomBoundaryStatus;
  readonly boundary: readonly WorldPoint[];
  readonly boundaryEdgeIds: readonly TId[];
}

interface HalfEdge<TId> {
  readonly from: number;
  readonly to: number;
  readonly edgeId: TId;
  readonly twin: number;
}

interface Graph<TId> {
  readonly vertices: WorldPoint[];
  readonly halfEdges: HalfEdge<TId>[];
  readonly adjacency: Map<number, number[]>;
}

function buildGraph<TId>(edges: readonly RoomBoundaryEdge<TId>[], tolerance: number): Graph<TId> {
  const vertices: WorldPoint[] = [];
  const halfEdges: HalfEdge<TId>[] = [];
  const adjacency = new Map<number, number[]>();

  function vertexIndexFor(point: WorldPoint): number {
    for (let i = 0; i < vertices.length; i += 1) {
      if (pointsAreCoincident(vertices[i]!, point, tolerance)) {
        return i;
      }
    }
    vertices.push(point);
    adjacency.set(vertices.length - 1, []);
    return vertices.length - 1;
  }

  for (const edge of edges) {
    if (pointsAreCoincident(edge.start, edge.end, tolerance)) {
      continue; // degenerate zero-length edge (blueprint section 42) - cannot bound anything
    }
    const vs = vertexIndexFor(edge.start);
    const ve = vertexIndexFor(edge.end);
    if (vs === ve) {
      continue; // snapped to the same vertex within tolerance - degenerate
    }
    const idxA = halfEdges.length;
    const idxB = idxA + 1;
    halfEdges.push({ from: vs, to: ve, edgeId: edge.id, twin: idxB });
    halfEdges.push({ from: ve, to: vs, edgeId: edge.id, twin: idxA });
    adjacency.get(vs)!.push(idxA);
    adjacency.get(ve)!.push(idxB);
  }

  return { vertices, halfEdges, adjacency };
}

function angleAt(from: WorldPoint, to: WorldPoint): number {
  return Math.atan2(to.y - from.y, to.x - from.x);
}

/** The next half-edge in a face trace: the smallest clockwise turn from the reverse of the incoming edge - see this module's doc comment. */
function nextHalfEdge<TId>(graph: Graph<TId>, currentIdx: number): number {
  const current = graph.halfEdges[currentIdx]!;
  const v = current.to;
  const incident = graph.adjacency.get(v) ?? [];
  const candidates = incident.filter((idx) => idx !== current.twin);
  if (candidates.length === 0) {
    return current.twin; // dead end (degree-1 vertex) - the only way onward is back the way we came
  }
  const backAngle = angleAt(graph.vertices[v]!, graph.vertices[current.from]!);
  const twoPi = Math.PI * 2;
  let best = candidates[0]!;
  let bestDelta = Number.POSITIVE_INFINITY;
  for (const idx of candidates) {
    const candidate = graph.halfEdges[idx]!;
    const angle = angleAt(graph.vertices[v]!, graph.vertices[candidate.to]!);
    let delta = backAngle - angle;
    delta = ((delta % twoPi) + twoPi) % twoPi;
    if (delta === 0) {
      delta = twoPi;
    }
    if (delta < bestDelta) {
      bestDelta = delta;
      best = idx;
    }
  }
  return best;
}

interface Face<TId> {
  readonly points: readonly WorldPoint[];
  readonly edgeIds: readonly TId[];
}

function traceAllFaces<TId>(graph: Graph<TId>): readonly Face<TId>[] {
  const visited = new Array<boolean>(graph.halfEdges.length).fill(false);
  const faces: Face<TId>[] = [];
  const maxSteps = graph.halfEdges.length + 1;

  for (let start = 0; start < graph.halfEdges.length; start += 1) {
    if (visited[start]) {
      continue;
    }
    const points: WorldPoint[] = [];
    const edgeIds: TId[] = [];
    let current = start;
    let steps = 0;
    let closed = false;
    do {
      visited[current] = true;
      const he = graph.halfEdges[current]!;
      points.push(graph.vertices[he.from]!);
      edgeIds.push(he.edgeId);
      current = nextHalfEdge(graph, current);
      steps += 1;
      if (current === start) {
        closed = true;
        break;
      }
    } while (steps <= maxSteps && !visited[current]);
    if (closed) {
      faces.push({ points, edgeIds });
    }
  }
  return faces;
}

/**
 * Finds the smallest enclosed polygon (from `edges`) containing
 * `seedPoint` - blueprint section 49's "click within an enclosed
 * boundary; calculate polygon". Returns 'not-enclosed' when no bounded
 * face contains the seed point, and 'invalid-polygon' only for an
 * invalid `tolerance` (never a hidden fallback epsilon, per ARQ-081).
 */
export function traceRoomBoundary<TId>(
  edges: readonly RoomBoundaryEdge<TId>[],
  seedPoint: WorldPoint,
  tolerance: number,
): RoomBoundaryResult<TId> {
  if (!Number.isFinite(tolerance) || tolerance < 0) {
    return { status: 'invalid-polygon', boundary: [], boundaryEdgeIds: [] };
  }

  const graph = buildGraph(edges, tolerance);
  const faces = traceAllFaces(graph);

  let best: Face<TId> | null = null;
  let bestArea = Number.POSITIVE_INFINITY;
  const areaEpsilon = tolerance * tolerance;
  for (const face of faces) {
    if (face.points.length < 3) {
      continue;
    }
    const area = signedArea(face.points);
    if (area <= areaEpsilon) {
      continue; // non-positive area: the unbounded outer face, or degenerate
    }
    if (!pointInPolygon(face.points, seedPoint, tolerance)) {
      continue;
    }
    if (area < bestArea) {
      bestArea = area;
      best = face;
    }
  }

  if (!best) {
    return { status: 'not-enclosed', boundary: [], boundaryEdgeIds: [] };
  }
  return { status: 'valid', boundary: best.points, boundaryEdgeIds: best.edgeIds };
}
