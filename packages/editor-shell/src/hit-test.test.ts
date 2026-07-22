import { describe, expect, it } from 'vitest';
import { worldPoint, type Viewport } from '@arq/geometry-2d';
import { pickAt, type HitCandidate } from './hit-test';

const viewportAt = (pixelsPerUnit: number): Viewport => ({
  center: worldPoint(0, 0),
  pixelsPerUnit,
  screenWidth: 800,
  screenHeight: 600,
});

function circleCandidate(
  id: string,
  center: { x: number; y: number },
  radiusWorld: number,
): HitCandidate<string> {
  return {
    id,
    hitTest(point, toleranceWorld) {
      const dx = point.x - center.x;
      const dy = point.y - center.y;
      return Math.hypot(dx, dy) <= radiusWorld + toleranceWorld;
    },
  };
}

describe('pickAt', () => {
  it('returns the candidate whose shape contains the point', () => {
    const candidates = [circleCandidate('a', { x: 0, y: 0 }, 1)];
    const hit = pickAt(candidates, worldPoint(0.5, 0), viewportAt(1));
    expect(hit?.id).toBe('a');
  });

  it('returns undefined when no candidate is within tolerance', () => {
    const candidates = [circleCandidate('a', { x: 0, y: 0 }, 1)];
    const hit = pickAt(candidates, worldPoint(100, 100), viewportAt(1));
    expect(hit).toBeUndefined();
  });

  it('converts the screen-pixel tolerance to world units using the current zoom level', () => {
    const candidates = [circleCandidate('a', { x: 0, y: 0 }, 1)];
    // the point is 1.5 world units away (0.5 beyond the radius-1 circle),
    // so hitting it needs >=0.5 world units of tolerance.
    // at 1 pixel per world unit, 6px of tolerance = 6 world units - plenty.
    expect(pickAt(candidates, worldPoint(1.5, 0), viewportAt(1), 6)?.id).toBe('a');
    // at 100 pixels per world unit, 6px of tolerance = 0.06 world units - not enough.
    expect(pickAt(candidates, worldPoint(1.5, 0), viewportAt(100), 6)).toBeUndefined();
  });

  it('returns the first matching candidate in priority order when several overlap', () => {
    const candidates = [
      circleCandidate('back', { x: 0, y: 0 }, 5),
      circleCandidate('front', { x: 0, y: 0 }, 5),
    ];
    expect(pickAt(candidates, worldPoint(0, 0), viewportAt(1))?.id).toBe('back');
  });
});
