/**
 * Reference 2D plan-view narrow phase. A production R-tree or equivalent owns
 * the broad phase. This code intentionally receives an index interface rather
 * than claiming that an in-memory Map is a spatial index.
 */

export interface Vec2 {
  readonly x: number;
  readonly y: number;
}

export interface Aabb2 {
  readonly min: Vec2;
  readonly max: Vec2;
}

export interface Segment2D {
  readonly id: string;
  readonly a: Vec2;
  readonly b: Vec2;
}

export interface PlanSpatialIndex {
  querySegments(bounds: Aabb2): readonly Segment2D[];
}

export interface PlanViewport {
  worldUnitsPerPixelAt(cursor: Vec2): number;
  screenDistancePx(a: Vec2, b: Vec2): number;
}

export type SnapType = 'ENDPOINT' | 'INTERSECTION' | 'MIDPOINT' | 'NEAREST';

export interface SnapCandidate {
  readonly point: Vec2;
  readonly type: SnapType;
  readonly distancePx: number;
  readonly targetIds: readonly string[];
}

export interface SnapConfig {
  readonly tolerancePx: number;
  readonly parallelEpsilon: number;
  readonly precedence?: Partial<Record<SnapType, number>>;
}

const defaultPrecedence: Record<SnapType, number> = {
  ENDPOINT: 0,
  INTERSECTION: 1,
  MIDPOINT: 2,
  NEAREST: 3,
};

export class PlanSnapEngine {
  public snap(
    cursor: Vec2,
    index: PlanSpatialIndex,
    viewport: PlanViewport,
    config: SnapConfig,
  ): SnapCandidate | undefined {
    if (config.tolerancePx <= 0 || config.parallelEpsilon <= 0) {
      throw new Error('Snap tolerances must be positive.');
    }

    const worldRadius = viewport.worldUnitsPerPixelAt(cursor) * config.tolerancePx;
    if (!Number.isFinite(worldRadius) || worldRadius <= 0) {
      return undefined;
    }

    const queryBounds: Aabb2 = {
      min: { x: cursor.x - worldRadius, y: cursor.y - worldRadius },
      max: { x: cursor.x + worldRadius, y: cursor.y + worldRadius },
    };
    const segments = index.querySegments(queryBounds);
    const candidates: SnapCandidate[] = [];
    const seen = new Set<string>();

    const add = (point: Vec2, type: SnapType, targetIds: readonly string[]): void => {
      const distancePx = viewport.screenDistancePx(cursor, point);
      if (!Number.isFinite(distancePx) || distancePx > config.tolerancePx) {
        return;
      }

      const key = [
        type,
        Math.round(point.x / config.parallelEpsilon),
        Math.round(point.y / config.parallelEpsilon),
        [...targetIds].sort().join(','),
      ].join('|');
      if (seen.has(key)) {
        return;
      }
      seen.add(key);
      candidates.push({ point, type, distancePx, targetIds: [...targetIds].sort() });
    };

    for (const segment of segments) {
      add(segment.a, 'ENDPOINT', [segment.id]);
      add(segment.b, 'ENDPOINT', [segment.id]);
      add(midpoint(segment.a, segment.b), 'MIDPOINT', [segment.id]);

      const nearest = projectPointOntoSegment(cursor, segment.a, segment.b);
      add(nearest, 'NEAREST', [segment.id]);
    }

    // The broad phase keeps this candidate set small. A production index can
    // add specialised arc/spline and intersection queries without changing the
    // ranking contract below.
    for (let left = 0; left < segments.length; left += 1) {
      for (let right = left + 1; right < segments.length; right += 1) {
        const intersection = segmentIntersection(
          segments[left],
          segments[right],
          config.parallelEpsilon,
        );
        if (intersection) {
          add(intersection, 'INTERSECTION', [segments[left].id, segments[right].id]);
        }
      }
    }

    const precedence = { ...defaultPrecedence, ...config.precedence };
    return candidates.sort((a, b) => {
      const priority = precedence[a.type] - precedence[b.type];
      if (priority !== 0) {
        return priority;
      }
      const distance = a.distancePx - b.distancePx;
      if (distance !== 0) {
        return distance;
      }
      const aKey = a.targetIds.join('|');
      const bKey = b.targetIds.join('|');
      return aKey.localeCompare(bKey);
    })[0];
  }
}

function midpoint(a: Vec2, b: Vec2): Vec2 {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

function projectPointOntoSegment(point: Vec2, a: Vec2, b: Vec2): Vec2 {
  const abx = b.x - a.x;
  const aby = b.y - a.y;
  const abSquared = abx * abx + aby * aby;
  if (abSquared === 0) {
    return a;
  }

  const apx = point.x - a.x;
  const apy = point.y - a.y;
  const parameter = (apx * abx + apy * aby) / abSquared;
  const clamped = Math.max(0, Math.min(1, parameter));
  return { x: a.x + clamped * abx, y: a.y + clamped * aby };
}

function segmentIntersection(
  first: Segment2D,
  second: Segment2D,
  epsilon: number,
): Vec2 | undefined {
  const r = { x: first.b.x - first.a.x, y: first.b.y - first.a.y };
  const s = { x: second.b.x - second.a.x, y: second.b.y - second.a.y };
  const denominator = cross(r, s);
  if (Math.abs(denominator) <= epsilon) {
    return undefined;
  }

  const delta = { x: second.a.x - first.a.x, y: second.a.y - first.a.y };
  const firstParameter = cross(delta, s) / denominator;
  const secondParameter = cross(delta, r) / denominator;
  if (
    firstParameter < -epsilon ||
    firstParameter > 1 + epsilon ||
    secondParameter < -epsilon ||
    secondParameter > 1 + epsilon
  ) {
    return undefined;
  }

  return {
    x: first.a.x + firstParameter * r.x,
    y: first.a.y + firstParameter * r.y,
  };
}

function cross(a: Vec2, b: Vec2): number {
  return a.x * b.y - a.y * b.x;
}
