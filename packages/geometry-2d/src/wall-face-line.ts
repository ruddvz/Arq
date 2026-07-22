/**
 * Shared by wall-outline.ts (ARQ-093) and the wall-join primitives
 * (butt-join.ts/mitre-join.ts, ARQ-095/096): the infinite line a single
 * face of a wall's rectangular footprint lies on, before either module
 * decides what to do with it (wall-outline.ts uses both faces bounded
 * to the centerline's own endpoints to build the 4-corner rectangle;
 * the join primitives intersect one wall's face line, unbounded,
 * against another wall's line).
 *
 * Same left/right convention as wall-outline.ts: 'left' is the
 * centerline direction rotated +90 degrees (counter-clockwise), matching
 * vector.ts's crossProduct/polygon-area.ts's signedArea convention.
 */

import { normalizeVector, translatePoint, vector2, vectorBetween, vectorLength } from './vector';
import type { WorldPoint } from './coordinate-system';
import type { Segment } from './segment';

export type WallAlignment = 'centre' | 'interior' | 'exterior';
export type WallFaceSide = 'left' | 'right';

/** The perpendicular offset (from the centerline) of each face, in this codebase's left/right convention. */
export function wallFaceOffsets(
  thickness: number,
  alignment: WallAlignment,
): { readonly left: number; readonly right: number } {
  switch (alignment) {
    case 'centre':
      return { left: thickness / 2, right: thickness / 2 };
    case 'interior':
      return { left: thickness, right: 0 };
    case 'exterior':
      return { left: 0, right: thickness };
  }
}

/**
 * Returns a Segment lying on (but not bounded to any particular length
 * along) the given face's line - null if the centerline is degenerate
 * (zero-length within `tolerance`) or thickness/tolerance are invalid.
 */
export function wallFaceLine(
  centerline: Segment,
  thickness: number,
  alignment: WallAlignment,
  side: WallFaceSide,
  tolerance: number,
): Segment | null {
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
  const { left: leftOffset, right: rightOffset } = wallFaceOffsets(thickness, alignment);
  const offset = side === 'left' ? leftOffset : -rightOffset;
  const offsetVector = vector2(left.x * offset, left.y * offset);
  return {
    start: translatePoint(centerline.start, offsetVector),
    end: translatePoint(centerline.end, offsetVector),
  };
}

export function faceLineCorners(
  centerline: Segment,
  thickness: number,
  alignment: WallAlignment,
  tolerance: number,
): readonly [WorldPoint, WorldPoint, WorldPoint, WorldPoint] | null {
  const leftLine = wallFaceLine(centerline, thickness, alignment, 'left', tolerance);
  const rightLine = wallFaceLine(centerline, thickness, alignment, 'right', tolerance);
  if (!leftLine || !rightLine) {
    return null;
  }
  return [leftLine.start, leftLine.end, rightLine.end, rightLine.start];
}
