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
 */

import {
  normalizeVector,
  scaleVector,
  translatePoint,
  vector2,
  vectorBetween,
  vectorLength,
} from './vector';
import type { WorldPoint } from './coordinate-system';
import type { Segment } from './segment';

export type WallAlignment = 'centre' | 'interior' | 'exterior';

export function wallOutline(
  centerline: Segment,
  thickness: number,
  alignment: WallAlignment,
  tolerance: number,
): readonly WorldPoint[] | null {
  if (
    !Number.isFinite(thickness) ||
    thickness <= 0 ||
    !Number.isFinite(tolerance) ||
    tolerance < 0
  ) {
    return null;
  }

  const direction = vectorBetween(centerline.start, centerline.end);
  if (vectorLength(direction) <= tolerance) {
    return null;
  }
  const normalized = normalizeVector(direction);
  if (!normalized) {
    return null;
  }

  const left = vector2(-normalized.y, normalized.x);

  let leftOffset: number;
  let rightOffset: number;
  switch (alignment) {
    case 'centre':
      leftOffset = thickness / 2;
      rightOffset = thickness / 2;
      break;
    case 'interior':
      leftOffset = thickness;
      rightOffset = 0;
      break;
    case 'exterior':
      leftOffset = 0;
      rightOffset = thickness;
      break;
  }

  const leftStart = translatePoint(centerline.start, scaleVector(left, leftOffset));
  const leftEnd = translatePoint(centerline.end, scaleVector(left, leftOffset));
  const rightStart = translatePoint(centerline.start, scaleVector(left, -rightOffset));
  const rightEnd = translatePoint(centerline.end, scaleVector(left, -rightOffset));

  return [leftStart, leftEnd, rightEnd, rightStart];
}
