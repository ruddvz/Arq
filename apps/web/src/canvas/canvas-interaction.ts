import {
  closestPointOnSegment,
  screenPoint,
  screenToWorld,
  worldPoint,
  type Viewport,
  type WorldPoint,
} from '@arq/geometry-2d';
import {
  combineSnapSources,
  findEndpointSnaps,
  findGridSnap,
  findMidpointSnaps,
  pickAt,
  pickBestSnap,
  type HitCandidate,
  type SnapResult,
} from '@arq/editor-shell';
import type { DrawnWall } from './plan-document';

/**
 * Pure interaction helpers for the plan canvas: the snapping pipeline and
 * hit-testing over the content this build renders (the demo room fixture
 * plus user-drawn walls). Kept free of React and canvas state so the
 * behaviour is unit-testable the same way the editor-shell libraries are.
 */

export const GRID_SPACING_MM = 250;

export interface PlanContent {
  readonly roomId: string;
  readonly roomPolygon: readonly WorldPoint[];
  readonly walls: readonly DrawnWall[];
}

/**
 * The snap pipeline the wall tool runs on every pointer move: endpoint and
 * midpoint snaps from every existing wall (and the room fixture's corners),
 * then the grid - combined and resolved by the editor-shell tie-break rule
 * (priority first, screen distance second).
 */
export function computeSnap(
  cursor: WorldPoint,
  content: PlanContent,
  viewport: Viewport,
): SnapResult | undefined {
  const endpoints = [
    ...content.roomPolygon.map((point) => ({ point })),
    ...content.walls.flatMap((wall) => [{ point: wall.start }, { point: wall.end }]),
  ];
  const segments = content.walls.map((wall) => ({ start: wall.start, end: wall.end }));
  return pickBestSnap(
    combineSnapSources(
      findEndpointSnaps(endpoints, cursor, viewport),
      findMidpointSnaps(segments, cursor, viewport),
      (() => {
        const grid = findGridSnap(cursor, GRID_SPACING_MM, viewport);
        return grid === undefined ? [] : [grid];
      })(),
    ),
  );
}

function segmentCandidate(id: string, start: WorldPoint, end: WorldPoint): HitCandidate<string> {
  return {
    id,
    hitTest: (point, toleranceWorld) => {
      const closest = closestPointOnSegment({ start, end }, point);
      return Math.hypot(closest.x - point.x, closest.y - point.y) <= toleranceWorld;
    },
  };
}

/**
 * Hit candidates in pick-priority order: drawn walls first (latest on
 * top, matching paint order), then the room fixture's boundary - so a
 * wall drawn along the room edge is selectable in preference to the room.
 */
export function buildHitCandidates(content: PlanContent): readonly HitCandidate<string>[] {
  const wallCandidates = [...content.walls]
    .reverse()
    .map((wall) => segmentCandidate(wall.id, wall.start, wall.end));
  const roomEdges: HitCandidate<string> = {
    id: content.roomId,
    hitTest: (point, toleranceWorld) =>
      content.roomPolygon.some((vertex, index) => {
        const next = content.roomPolygon[(index + 1) % content.roomPolygon.length]!;
        const closest = closestPointOnSegment({ start: vertex, end: next }, point);
        return Math.hypot(closest.x - point.x, closest.y - point.y) <= toleranceWorld;
      }),
  };
  return [...wallCandidates, roomEdges];
}

/** pickAt over the build's content - null when the click lands on empty canvas. */
export function pickElementAt(
  content: PlanContent,
  point: WorldPoint,
  viewport: Viewport,
): string | null {
  return pickAt(buildHitCandidates(content), point, viewport)?.id ?? null;
}

/** World-space bounds of everything visible, for the fit tool. */
export function contentBounds(content: PlanContent): {
  readonly min: WorldPoint;
  readonly max: WorldPoint;
} {
  const points: WorldPoint[] = [
    ...content.roomPolygon,
    ...content.walls.flatMap((wall) => [wall.start, wall.end]),
  ];
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
  return { min: worldPoint(minX, minY), max: worldPoint(maxX, maxY) };
}

/** Standard wheel-to-zoom mapping: exponential in deltaY, clamped per step. */
export function wheelZoomFactor(deltaY: number): number {
  const factor = Math.exp(-deltaY * 0.0015);
  return Math.min(2, Math.max(0.5, factor));
}

/** Convenience: client-rect-relative pointer position to world space. */
export function clientToWorld(
  viewport: Viewport,
  devicePixelRatio: number,
  offsetX: number,
  offsetY: number,
): WorldPoint {
  return screenToWorld(
    viewport,
    screenPoint(offsetX * devicePixelRatio, offsetY * devicePixelRatio),
  );
}
