/**
 * ARQ-124: generate wall meshes.
 *
 * Blueprint section 39 lists "generated wall mesh; slab mesh" together
 * under geometry-3d's own responsibilities - both are "extrude a
 * planar 2D outline vertically into a solid," so this module
 * implements that one operation generically (extrudePolygonMesh)
 * rather than a wall-specific function, and a slab (a later issue) can
 * reuse it unchanged. Single-ring, convex-outline scope only, the same
 * limit polygon-area.ts (ARQ-085) and room-boundary-graph.ts (ARQ-111)
 * already document - a wall's rectangular footprint (wall-outline.ts,
 * ARQ-093) is always convex, so this is not a gap for Release 1's
 * straight-wall scope; a concave outline would triangulate incorrectly
 * with this module's fan triangulation.
 *
 * Deliberately produces plain typed-array mesh data (Mesh3D), not a
 * THREE.Object3D - geometry-3d has no Three.js dependency (blueprint
 * section 39: "render-level geometry only until exact solids are
 * introduced," and section 63 prohibits coupling project/geometry
 * semantics to a renderer). @arq/model-renderer (ARQ-123) is the
 * caller that turns a Mesh3D into an actual THREE.BufferGeometry - the
 * Float64Array/Uint32Array shape here is exactly what
 * BufferGeometry.setAttribute/setIndex already expect, so that
 * conversion is a direct pass-through, not a rewrite.
 *
 * Coordinate mapping, matching model-scene.ts (ARQ-123) exactly: a 2D
 * outline point (x, y) becomes 3D (x, elevation, y) - plan (x, y) maps
 * to the 3D (x, z) ground plane, with 3D y as height. Every mesh this
 * module produces must agree with that mapping, or plan and 3D would
 * visually disagree (section 45's named bug to prevent).
 *
 * Winding-independent by design: wall-outline.ts's actual output
 * happens to be clockwise in this codebase's polygon convention
 * (verified directly - not assumed), while a hand-authored CCW polygon
 * would be just as reasonable input from some other caller. Rather
 * than document "callers must pass CCW" as a footgun, this module
 * measures the outline's own winding (geometry-2d's signedArea,
 * ARQ-085) and normalises internally, so the mesh's faces point
 * outward regardless of which winding the caller's outline happens to
 * use.
 */

import { signedArea } from '@arq/geometry-2d';
import type { WorldPoint } from '@arq/geometry-2d';

export interface Mesh3D {
  readonly positions: Float64Array;
  readonly normals: Float64Array;
  readonly indices: Uint32Array;
}

interface Vector3Like {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

function subtract(a: Vector3Like, b: Vector3Like): Vector3Like {
  return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
}

function cross(a: Vector3Like, b: Vector3Like): Vector3Like {
  return {
    x: a.y * b.z - a.z * b.y,
    y: a.z * b.x - a.x * b.z,
    z: a.x * b.y - a.y * b.x,
  };
}

function normalize(v: Vector3Like): Vector3Like {
  const length = Math.hypot(v.x, v.y, v.z);
  if (length === 0) {
    return { x: 0, y: 0, z: 0 };
  }
  return { x: v.x / length, y: v.y / length, z: v.z / length };
}

/** Appends one flat-shaded triangle (a, b, c) with the geometrically-computed normal for that winding; returns nothing, mutates the builder arrays. */
function pushTriangle(
  positions: number[],
  normals: number[],
  indices: number[],
  a: Vector3Like,
  b: Vector3Like,
  c: Vector3Like,
): void {
  const normal = normalize(cross(subtract(b, a), subtract(c, a)));
  const base = positions.length / 3;
  for (const vertex of [a, b, c]) {
    positions.push(vertex.x, vertex.y, vertex.z);
    normals.push(normal.x, normal.y, normal.z);
  }
  indices.push(base, base + 1, base + 2);
}

/**
 * Extrudes a planar 2D outline into a closed solid mesh between
 * `baseElevation` and `baseElevation + height` - "generated wall mesh"/
 * "slab mesh" (section 39). Returns null for any input this module
 * cannot safely mesh: fewer than 3 outline points, a non-finite
 * coordinate anywhere in the outline, or a non-finite/non-positive
 * height/baseElevation - the same "null for degenerate geometric
 * input" contract wallFaceLine (wall-face-line.ts) and
 * projectEndpointOntoBoundary (wall-trim-extend.ts) already use.
 */
export function extrudePolygonMesh(
  outline: readonly WorldPoint[],
  baseElevation: number,
  height: number,
): Mesh3D | null {
  if (outline.length < 3) {
    return null;
  }
  if (!Number.isFinite(baseElevation) || !Number.isFinite(height) || height <= 0) {
    return null;
  }
  for (const point of outline) {
    if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) {
      return null;
    }
  }

  // Normalise to CCW (positive signed area) so the winding orders below
  // always produce outward-facing normals regardless of the caller's
  // own convention - see this module's doc comment.
  const ccwOutline = signedArea(outline) < 0 ? [...outline].reverse() : outline;

  const bottom: Vector3Like[] = ccwOutline.map((p) => ({ x: p.x, y: baseElevation, z: p.y }));
  const top: Vector3Like[] = ccwOutline.map((p) => ({ x: p.x, y: baseElevation + height, z: p.y }));

  const positions: number[] = [];
  const normals: number[] = [];
  const indices: number[] = [];
  const n = ccwOutline.length;

  // Bottom cap: forward fan from vertex 0 - faces downward (-Y).
  for (let i = 1; i < n - 1; i += 1) {
    pushTriangle(positions, normals, indices, bottom[0]!, bottom[i]!, bottom[i + 1]!);
  }
  // Top cap: reversed fan from vertex 0 - faces upward (+Y).
  for (let i = 1; i < n - 1; i += 1) {
    pushTriangle(positions, normals, indices, top[0]!, top[i + 1]!, top[i]!);
  }
  // Side faces: one quad (two triangles) per outline edge, outward-facing.
  for (let i = 0; i < n; i += 1) {
    const next = (i + 1) % n;
    pushTriangle(positions, normals, indices, bottom[i]!, top[next]!, bottom[next]!);
    pushTriangle(positions, normals, indices, bottom[i]!, top[i]!, top[next]!);
  }

  return {
    positions: new Float64Array(positions),
    normals: new Float64Array(normals),
    indices: new Uint32Array(indices),
  };
}
