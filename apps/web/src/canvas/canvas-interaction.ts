import {
  closestPointOnSegment,
  DEFAULT_TOLERANCES,
  screenPoint,
  screenToWorld,
  segmentIntersection,
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
  selectInRegion,
  type HitCandidate,
  type RegionCandidate,
  type RegionSelectionMode,
  type SnapResult,
  type WorldBounds,
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

function pointInBounds(point: WorldPoint, bounds: WorldBounds): boolean {
  return (
    point.x >= bounds.min.x &&
    point.x <= bounds.max.x &&
    point.y >= bounds.min.y &&
    point.y <= bounds.max.y
  );
}

function segmentIntersectsBounds(start: WorldPoint, end: WorldPoint, bounds: WorldBounds): boolean {
  if (pointInBounds(start, bounds) || pointInBounds(end, bounds)) {
    return true;
  }
  const corners = [
    worldPoint(bounds.min.x, bounds.min.y),
    worldPoint(bounds.max.x, bounds.min.y),
    worldPoint(bounds.max.x, bounds.max.y),
    worldPoint(bounds.min.x, bounds.max.y),
  ];
  for (let i = 0; i < 4; i += 1) {
    const edge = { start: corners[i]!, end: corners[(i + 1) % 4]! };
    if (segmentIntersection({ start, end }, edge, DEFAULT_TOLERANCES.coordinateEpsilon) !== null) {
      return true;
    }
  }
  return false;
}

function wallRegionCandidate(wall: DrawnWall): RegionCandidate<string> {
  return {
    id: wall.id,
    isContainedBy: (region) => pointInBounds(wall.start, region) && pointInBounds(wall.end, region),
    intersectsRegion: (region) => segmentIntersectsBounds(wall.start, wall.end, region),
  };
}

/**
 * Marquee selection over the drawn walls, using the editor-shell
 * window/crossing contract (ARQ-041). The room fixture is deliberately not
 * region-selectable: a marquee over the plan almost always encloses the
 * fixture, and "everything you dragged over plus the demo room" is never
 * what the drag meant.
 */
export function selectWallsInRegion(
  content: PlanContent,
  region: WorldBounds,
  mode: RegionSelectionMode,
): readonly string[] {
  return selectInRegion(content.walls.map(wallRegionCandidate), region, mode);
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
