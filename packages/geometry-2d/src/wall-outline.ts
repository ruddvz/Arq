/**
 * ARQ-093: implement wall outline.
 *
 * Computes a wall's rectangular outline (the 4-corner polygon of its
 * footprint) from a centerline, a thickness, and an alignment - pure
 * geometry, taking plain numbers rather than @arq/bim-core's Wall/
 * WallType (ARQ-091/092): this stays in @arq/geometry-2d specifically so
 * it does not depend on bim-core, keeping the dependency direction one
 * way (bim-core depends on geometry-2d, never the reverse). A caller
 * with a real Wall/WallType converts the type's Length thickness to
 * whatever plain-number convention this codebase's world space uses
 * (coordinate-system.ts's documented provisional choice) before calling
 * this function.
 *
 * Alignment convention, stated explicitly because "interior"/"exterior"
 * cannot be determined from a lone segment alone (that requires knowing
 * which side of the wall faces a building's exterior, i.e. room/building
 * context this function does not have): 'interior' offsets the entire
 * thickness to the left of the segment's start->end direction, using
 * the same counter-clockwise-positive convention as vector.ts's
 * crossProduct and polygon-area.ts's signedArea (left = the direction
 * rotated +90 degrees); 'exterior' offsets to the right. Orienting a
 * wall's start->end direction so this convention matches the real
 * building's actual interior/exterior is the caller's responsibility.
 *
 * Tolerance behaviour is explicit: returns null for a zero-length (or
 * near-zero-length, within `tolerance`) centerline or a non-positive
 * thickness - neither has a well-defined rectangular outline.
 *
 * The per-face offset math itself now lives in wall-face-line.ts, shared
 * with the wall-join primitives (butt-join.ts/mitre-join.ts, ARQ-095/096)
 * which need the same two face lines but unbounded, to intersect against
 * another wall's line rather than closed into a rectangle.
 */

import { faceLineCorners, type WallAlignment } from './wall-face-line';
import type { WorldPoint } from './coordinate-system';
import type { Segment } from './segment';

export type { WallAlignment };

export function wallOutline(
  centerline: Segment,
  thickness: number,
  alignment: WallAlignment,
  tolerance: number,
): readonly WorldPoint[] | null {
  return faceLineCorners(centerline, thickness, alignment, tolerance);
}
