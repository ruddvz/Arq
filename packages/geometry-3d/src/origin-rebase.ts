/**
 * V3-126 / AC3-070: a large-coordinate project renders with accepted precision.
 *
 * The model holds coordinates in float64, which has 53 bits of significand and
 * loses nothing a building can express. The GPU does not: vertex buffers,
 * matrices and interpolators are float32, with 24 bits. Precision in a float is
 * relative to magnitude, so those 24 bits buy about 0.06mm of resolution at
 * 1km from the origin and about 60mm at 1000km.
 *
 * That matters because real projects are not at the origin. A site georeferenced
 * to a national grid sits at coordinates in the hundreds of thousands of metres,
 * and at that magnitude a float32 vertex snaps to a grid coarser than the wall
 * it belongs to. The visible result is AC3-070's failure: geometry that jitters
 * as the camera moves, because each frame rounds slightly differently, and hit
 * tests that pick the wrong element, because the ray and the triangle no longer
 * agree about where anything is.
 *
 * The fix is standard and the reason to write it down is that it is easy to do
 * halfway. Subtract a rebase origin from every coordinate before it reaches the
 * GPU, and carry the origin separately in float64. Halfway means rebasing the
 * vertices but not the camera, or rebasing for rendering but not for picking:
 * both leave two coordinate frames in play that agree at the origin and diverge
 * with distance, which is harder to diagnose than the jitter it replaced.
 *
 * So this module owns the decision (is a rebase needed, and to where) and the
 * conversion in both directions, and the round trip is exact by construction:
 * the origin is subtracted in float64 and added back in float64, and only the
 * difference is ever narrowed to float32.
 */

/** float32 carries 24 bits of significand, one of them implicit. */
export const FLOAT32_SIGNIFICAND_BITS = 24;

/**
 * The precision a rendered coordinate has to keep.
 *
 * 10 micrometres, matching `planar-topology-merge` in bim-core's tolerance
 * table - the finest distinction anything downstream draws. Rendering itself is
 * allowed to be coarser (that table's `rendering` class says so), but picking
 * is not: a hit test that resolves less finely than the merge tolerance can
 * report two coincident things as one, and it runs against the same buffers.
 */
export const REQUIRED_RENDER_PRECISION_MM = 0.01;

export interface Point3 {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

/**
 * The smallest difference float32 can represent near `magnitudeMm`.
 *
 * This is the whole argument in one function: precision is relative, so the
 * question is never "is float32 enough" but "is it enough this far out".
 */
export function float32PrecisionAt(magnitudeMm: number): number {
  const magnitude = Math.abs(magnitudeMm);
  if (magnitude === 0) {
    return 0;
  }
  const exponent = Math.floor(Math.log2(magnitude));
  return Math.pow(2, exponent - (FLOAT32_SIGNIFICAND_BITS - 1));
}

/** The furthest a coordinate can be from the origin before float32 stops resolving `precisionMm`. */
export function maxSafeFloat32Magnitude(precisionMm: number): number {
  return precisionMm * Math.pow(2, FLOAT32_SIGNIFICAND_BITS - 1);
}

export interface Extent3 {
  readonly min: Point3;
  readonly max: Point3;
}

export function extentOfPoints3(points: readonly Point3[]): Extent3 | null {
  if (points.length === 0) {
    return null;
  }
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let minZ = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  let maxZ = Number.NEGATIVE_INFINITY;
  for (const point of points) {
    minX = Math.min(minX, point.x);
    minY = Math.min(minY, point.y);
    minZ = Math.min(minZ, point.z);
    maxX = Math.max(maxX, point.x);
    maxY = Math.max(maxY, point.y);
    maxZ = Math.max(maxZ, point.z);
  }
  return { min: { x: minX, y: minY, z: minZ }, max: { x: maxX, y: maxY, z: maxZ } };
}

export interface RebaseDecision {
  readonly required: boolean;
  /** Subtracted from every coordinate before it reaches float32. Zero when no rebase is needed. */
  readonly origin: Point3;
  /** The worst precision the scene would have had without a rebase, in millimetres. */
  readonly precisionWithoutRebaseMm: number;
  /** The worst precision it has with one. */
  readonly precisionWithRebaseMm: number;
}

export const NO_REBASE_ORIGIN: Point3 = { x: 0, y: 0, z: 0 };

/**
 * Decides whether a scene needs rebasing, and to where.
 *
 * The origin is the centre of the extent rather than its minimum corner. Both
 * bring the far corner within range; the centre halves the largest magnitude
 * that remains, which is the number precision actually depends on. Using the
 * minimum corner would leave the whole extent on one side of zero and waste a
 * bit of significand for nothing.
 *
 * It is also rounded to a whole millimetre. An origin with a fractional part
 * would be a value the subtraction has to represent exactly on both sides of
 * the round trip; a whole number is exactly representable in float64 across the
 * entire range a project can reach, so the round trip cannot drift.
 */
export function decideRebase(
  extent: Extent3 | null,
  precisionMm: number = REQUIRED_RENDER_PRECISION_MM,
): RebaseDecision {
  if (extent === null) {
    return {
      required: false,
      origin: NO_REBASE_ORIGIN,
      precisionWithoutRebaseMm: 0,
      precisionWithRebaseMm: 0,
    };
  }

  const worstMagnitude = Math.max(
    Math.abs(extent.min.x),
    Math.abs(extent.min.y),
    Math.abs(extent.min.z),
    Math.abs(extent.max.x),
    Math.abs(extent.max.y),
    Math.abs(extent.max.z),
  );
  const precisionWithoutRebaseMm = float32PrecisionAt(worstMagnitude);

  const origin: Point3 = {
    x: Math.round((extent.min.x + extent.max.x) / 2),
    y: Math.round((extent.min.y + extent.max.y) / 2),
    z: Math.round((extent.min.z + extent.max.z) / 2),
  };

  const rebasedMagnitude = Math.max(
    Math.abs(extent.min.x - origin.x),
    Math.abs(extent.min.y - origin.y),
    Math.abs(extent.min.z - origin.z),
    Math.abs(extent.max.x - origin.x),
    Math.abs(extent.max.y - origin.y),
    Math.abs(extent.max.z - origin.z),
  );
  const precisionWithRebaseMm = float32PrecisionAt(rebasedMagnitude);

  const required = precisionWithoutRebaseMm > precisionMm;

  return {
    required,
    origin: required ? origin : NO_REBASE_ORIGIN,
    precisionWithoutRebaseMm,
    precisionWithRebaseMm: required ? precisionWithRebaseMm : precisionWithoutRebaseMm,
  };
}

/** Model space to render space. Subtracted in float64; only the result is ever narrowed. */
export function toRenderSpace(point: Point3, origin: Point3): Point3 {
  return { x: point.x - origin.x, y: point.y - origin.y, z: point.z - origin.z };
}

/**
 * Render space back to model space.
 *
 * Every value that leaves the renderer - a picked point, a measured distance, a
 * dragged position - has to come back through here. A pipeline that rebases on
 * the way in and not on the way out returns coordinates in a frame the model
 * has never heard of, offset by exactly the amount that made the rebase
 * necessary in the first place.
 */
export function toModelSpace(point: Point3, origin: Point3): Point3 {
  return { x: point.x + origin.x, y: point.y + origin.y, z: point.z + origin.z };
}

/**
 * Whether a rebase decision still covers a scene.
 *
 * A scene grows: a user drags a wall outward, or imports a survey. The origin
 * chosen for the old extent may no longer keep the new one in range, and
 * nothing notices unless something asks. Re-deciding on every frame would be
 * worse than the problem - the origin would move under the camera - so this is
 * a check a caller makes when the extent actually changes.
 */
export function rebaseStillValid(
  origin: Point3,
  extent: Extent3,
  precisionMm: number = REQUIRED_RENDER_PRECISION_MM,
): boolean {
  const magnitude = Math.max(
    Math.abs(extent.min.x - origin.x),
    Math.abs(extent.min.y - origin.y),
    Math.abs(extent.min.z - origin.z),
    Math.abs(extent.max.x - origin.x),
    Math.abs(extent.max.y - origin.y),
    Math.abs(extent.max.z - origin.z),
  );
  return float32PrecisionAt(magnitude) <= precisionMm;
}

/** What float32 would actually store, for tests and diagnostics that need the real loss rather than a model of it. */
export function narrowToFloat32(value: number): number {
  return Math.fround(value);
}
