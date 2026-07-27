import { elementId } from '@arq/bim-core';
import type { WorldPoint } from '@arq/geometry-2d';
import type { ValidationMessage } from '@arq/operations';

/**
 * §4.3 wall-segment rules. Every message follows the product's error
 * structure (docs/product/PRODUCT-COPY-PRINCIPLES.md): what happened
 * (title), why (explanation), what was affected (affectedElementIds),
 * what the user can do (suggestedActions) - and "what remains safe" is
 * the contract itself: validation never mutates anything, and a caller
 * must refuse to apply an operation whose messages contain errors.
 */

/**
 * Below this, a wall is a point in any practical drawing. 1 mm keeps the
 * rule about degenerate geometry (double-clicks, snapped-to-same-point
 * chains), not about opinionated minimum wall sizes - real minimum-size
 * policy is a product decision recorded nowhere yet, so it is not
 * invented here.
 */
export const MIN_WALL_SEGMENT_LENGTH_MM = 1;

export interface WallSegmentInput {
  readonly id: string;
  readonly start: WorldPoint;
  readonly end: WorldPoint;
}

function segmentLength(segment: WallSegmentInput): number {
  return Math.hypot(segment.end.x - segment.start.x, segment.end.y - segment.start.y);
}

/** One segment: finite coordinates and a non-degenerate length. */
export function validateWallSegment(
  segment: WallSegmentInput,
  minLengthMm: number = MIN_WALL_SEGMENT_LENGTH_MM,
): readonly ValidationMessage[] {
  const messages: ValidationMessage[] = [];
  const coordinates = [segment.start.x, segment.start.y, segment.end.x, segment.end.y];
  if (!coordinates.every(Number.isFinite)) {
    messages.push({
      id: `wall-non-finite-${segment.id}`,
      severity: 'error',
      code: 'WALL_NON_FINITE_GEOMETRY',
      title: 'Wall has a non-finite coordinate',
      explanation: `Wall "${segment.id}" has a coordinate that is not a finite number, so its geometry cannot be drawn or measured. No change was applied.`,
      affectedElementIds: [elementId(segment.id)],
      suggestedActions: ['Draw the wall again with points inside the plan.'],
    });
    return messages;
  }
  const length = segmentLength(segment);
  if (length < minLengthMm) {
    messages.push({
      id: `wall-too-short-${segment.id}`,
      severity: 'error',
      code: 'WALL_TOO_SHORT',
      title: 'Wall is shorter than the minimum',
      explanation: `Wall "${segment.id}" is ${length.toFixed(2)} mm long, below the ${minLengthMm} mm minimum - usually a double-placed point. No change was applied.`,
      affectedElementIds: [elementId(segment.id)],
      suggestedActions: [
        'Place the wall’s end point away from its start point.',
        'Press Escape to remove the last placed point.',
      ],
    });
  }
  return messages;
}

/**
 * A batch of segments: per-segment rules plus exact-duplicate detection
 * against both the batch itself and any already-committed segments.
 * Duplicates are warnings, not errors - an overlapping wall can be a
 * legitimate intermediate state, but the user should know it happened.
 */
export function validateWallSegments(
  segments: readonly WallSegmentInput[],
  existing: readonly WallSegmentInput[] = [],
  minLengthMm: number = MIN_WALL_SEGMENT_LENGTH_MM,
): readonly ValidationMessage[] {
  const messages: ValidationMessage[] = segments.flatMap((segment) =>
    validateWallSegment(segment, minLengthMm),
  );
  const seen = new Map<string, string>();
  for (const segment of existing) {
    seen.set(geometryKey(segment), segment.id);
  }
  for (const segment of segments) {
    const key = geometryKey(segment);
    const duplicateOf = seen.get(key);
    if (duplicateOf !== undefined && duplicateOf !== segment.id) {
      messages.push({
        id: `wall-duplicate-${segment.id}`,
        severity: 'warning',
        code: 'WALL_DUPLICATE_GEOMETRY',
        title: 'Wall duplicates an existing wall',
        explanation: `Wall "${segment.id}" has exactly the same start and end as wall "${duplicateOf}". Both walls exist; the duplicate may be unintended.`,
        affectedElementIds: [elementId(segment.id), elementId(duplicateOf)],
        suggestedActions: ['Delete one of the two walls if the duplication was unintended.'],
      });
    } else {
      seen.set(key, segment.id);
    }
  }
  return messages;
}

function geometryKey(segment: WallSegmentInput): string {
  const forward = `${segment.start.x},${segment.start.y}|${segment.end.x},${segment.end.y}`;
  const backward = `${segment.end.x},${segment.end.y}|${segment.start.x},${segment.start.y}`;
  return forward < backward ? forward : backward;
}
