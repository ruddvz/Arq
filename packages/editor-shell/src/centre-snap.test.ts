import { describe, expect, it } from 'vitest';
import { worldPoint, type Viewport } from '@arq/geometry-2d';
import { findCentreSnaps } from './centre-snap';
import { isValidCircularCandidate } from './circular-candidate';

const viewport: Viewport = {
  center: worldPoint(0, 0),
  pixelsPerUnit: 2,
  screenWidth: 800,
  screenHeight: 600,
};

describe('isValidCircularCandidate', () => {
  it('accepts finite circle and arc geometry with a positive radius', () => {
    expect(isValidCircularCandidate({ kind: 'circle', centre: worldPoint(4, 5), radius: 10 })).toBe(
      true,
    );
    expect(isValidCircularCandidate({ kind: 'arc', centre: worldPoint(-4, 5), radius: 0.25 })).toBe(
      true,
    );
  });

  it('rejects non-finite centres and non-positive or non-finite radii', () => {
    expect(
      isValidCircularCandidate({ kind: 'circle', centre: worldPoint(Number.NaN, 0), radius: 10 }),
    ).toBe(false);
    expect(isValidCircularCandidate({ kind: 'circle', centre: worldPoint(0, 0), radius: 0 })).toBe(
      false,
    );
    expect(
      isValidCircularCandidate({ kind: 'arc', centre: worldPoint(0, 0), radius: Infinity }),
    ).toBe(false);
  });
});

describe('findCentreSnaps', () => {
  it('returns circle and arc centres within the screen-space tolerance', () => {
    const results = findCentreSnaps(
      [
        { kind: 'circle', centre: worldPoint(5, 5), radius: 10 },
        { kind: 'arc', centre: worldPoint(20, 20), radius: 5 },
      ],
      worldPoint(8, 5),
      viewport,
      6,
    );

    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({
      source: 'centre',
      point: { x: 5, y: 5 },
      priority: 4,
      screenDistance: 6,
    });
  });

  it('keeps tolerance stable in screen pixels at different zoom levels', () => {
    const candidate = { kind: 'circle' as const, centre: worldPoint(5, 5), radius: 10 };

    expect(findCentreSnaps([candidate], worldPoint(10, 5), viewport, 10)).toHaveLength(1);
    expect(
      findCentreSnaps([candidate], worldPoint(10, 5), { ...viewport, pixelsPerUnit: 4 }, 10),
    ).toEqual([]);
  });

  it('ignores invalid circular candidates without producing a snap preview', () => {
    expect(
      findCentreSnaps(
        [{ kind: 'circle', centre: worldPoint(5, 5), radius: 0 }],
        worldPoint(5, 5),
        viewport,
      ),
    ).toEqual([]);
  });

  it('returns no results for invalid viewport scale or tolerance', () => {
    const candidate = { kind: 'circle' as const, centre: worldPoint(5, 5), radius: 10 };

    expect(
      findCentreSnaps([candidate], worldPoint(5, 5), { ...viewport, pixelsPerUnit: 0 }),
    ).toEqual([]);
    expect(findCentreSnaps([candidate], worldPoint(5, 5), viewport, -1)).toEqual([]);
  });
});
