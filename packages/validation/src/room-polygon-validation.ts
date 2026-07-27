import { elementId } from '@arq/bim-core';
import { polygonArea, segmentIntersection, type WorldPoint } from '@arq/geometry-2d';
import type { ValidationMessage } from '@arq/operations';

/**
 * §4.3 room-boundary rules for the single-ring polygons the rest of the
 * platform supports (polygon-area.ts, room-boundary-graph.ts): at least
 * three distinct vertices, a non-degenerate area, and no
 * self-intersection. Self-intersection is O(n²) over edge pairs -
 * boundaries here are wall-count sized (tens, not thousands), and a
 * correct simple check beats a clever one nothing needs yet.
 */

export const MIN_ROOM_AREA_MM2 = 1;

export function validateRoomPolygon(
  roomId: string,
  points: readonly WorldPoint[],
  toleranceMm = 1e-6,
): readonly ValidationMessage[] {
  const affected = [elementId(roomId)];
  if (points.length < 3) {
    return [
      {
        id: `room-too-few-points-${roomId}`,
        severity: 'error',
        code: 'ROOM_TOO_FEW_POINTS',
        title: 'Room boundary has too few points',
        explanation: `Room "${roomId}" has ${points.length} boundary point(s); a room needs at least three to enclose an area. No change was applied.`,
        affectedElementIds: affected,
        suggestedActions: ['Close the boundary with at least three corner points.'],
      },
    ];
  }
  // Self-intersection is diagnosed before area: a symmetric bow-tie's
  // shoelace area cancels to zero, and "your boundary crosses itself" is
  // the actionable diagnosis there - "no area" would be technically true
  // but misleading about the cause.
  for (let i = 0; i < points.length; i += 1) {
    const a = { start: points[i]!, end: points[(i + 1) % points.length]! };
    for (let j = i + 1; j < points.length; j += 1) {
      // Adjacent edges legitimately share a vertex; only test non-adjacent
      // pairs (and skip first-vs-last, which share the closing vertex).
      const adjacent = j === i + 1 || (i === 0 && j === points.length - 1);
      if (adjacent) {
        continue;
      }
      const b = { start: points[j]!, end: points[(j + 1) % points.length]! };
      if (segmentIntersection(a, b, toleranceMm) !== null) {
        return [
          {
            id: `room-self-intersecting-${roomId}`,
            severity: 'error',
            code: 'ROOM_SELF_INTERSECTING',
            title: 'Room boundary crosses itself',
            explanation: `Room "${roomId}"'s boundary edges ${i + 1} and ${j + 1} cross, so inside and outside are ambiguous. No change was applied.`,
            affectedElementIds: affected,
            suggestedActions: ['Redraw the boundary so its edges do not cross.'],
          },
        ];
      }
    }
  }
  if (polygonArea(points) < MIN_ROOM_AREA_MM2) {
    return [
      {
        id: `room-degenerate-${roomId}`,
        severity: 'error',
        code: 'ROOM_DEGENERATE_AREA',
        title: 'Room boundary encloses no area',
        explanation: `Room "${roomId}"'s boundary points are collinear or coincident, so the room has no area. No change was applied.`,
        affectedElementIds: affected,
        suggestedActions: ['Move the boundary points so they enclose a real area.'],
      },
    ];
  }
  return [];
}
