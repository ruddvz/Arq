import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import {
  screenPoint,
  screenToWorld,
  worldPoint,
  worldToScreen,
  type Viewport,
} from '@arq/geometry-2d';
import {
  MAX_PIXELS_PER_UNIT,
  MIN_PIXELS_PER_UNIT,
  fitToBounds,
  panByScreenDelta,
  preserveWorldUnderViewportRect,
  zoomAtScreenPoint,
} from './viewport-controller';

const baseViewport: Viewport = {
  center: worldPoint(0, 0),
  pixelsPerUnit: 1,
  screenWidth: 800,
  screenHeight: 600,
};

describe('panByScreenDelta', () => {
  it('follows a grab-and-drag gesture: content moves with the drag, so the world centre moves opposite in x but same-sense in y (y is flipped between screen and world)', () => {
    const panned = panByScreenDelta(baseViewport, 100, 50);
    expect(panned.center.x).toBeLessThan(baseViewport.center.x);
    expect(panned.center.y).toBeGreaterThan(baseViewport.center.y);
  });

  it('scales the world-space pan distance by the current zoom level', () => {
    const zoomedIn: Viewport = { ...baseViewport, pixelsPerUnit: 2 };
    const pannedBase = panByScreenDelta(baseViewport, 100, 0);
    const pannedZoomed = panByScreenDelta(zoomedIn, 100, 0);
    const baseDelta = baseViewport.center.x - pannedBase.center.x;
    const zoomedDelta = baseViewport.center.x - pannedZoomed.center.x;
    expect(zoomedDelta).toBeCloseTo(baseDelta / 2, 10);
  });

  it('leaves pixelsPerUnit and screen size untouched', () => {
    const panned = panByScreenDelta(baseViewport, 30, -20);
    expect(panned.pixelsPerUnit).toBe(baseViewport.pixelsPerUnit);
    expect(panned.screenWidth).toBe(baseViewport.screenWidth);
    expect(panned.screenHeight).toBe(baseViewport.screenHeight);
  });
});

describe('zoomAtScreenPoint', () => {
  it('rejects non-positive or non-finite factors', () => {
    expect(() => zoomAtScreenPoint(baseViewport, screenPoint(400, 300), 0)).toThrow(RangeError);
    expect(() => zoomAtScreenPoint(baseViewport, screenPoint(400, 300), -2)).toThrow(RangeError);
    expect(() => zoomAtScreenPoint(baseViewport, screenPoint(400, 300), Number.NaN)).toThrow(
      RangeError,
    );
    expect(() => zoomAtScreenPoint(baseViewport, screenPoint(400, 300), Infinity)).toThrow(
      RangeError,
    );
  });

  it('keeps the world point under an arbitrary anchor visually fixed after zooming', () => {
    fc.assert(
      fc.property(
        fc.float({ min: -500, max: 500, noNaN: true }),
        fc.float({ min: -500, max: 500, noNaN: true }),
        fc.float({ min: Math.fround(0.1), max: 10, noNaN: true }),
        (anchorX, anchorY, factor) => {
          const anchor = screenPoint(anchorX, anchorY);
          const zoomed = zoomAtScreenPoint(baseViewport, anchor, factor);
          // the anchor's world point, re-projected through the new viewport,
          // must land back on the same screen pixel it started at.
          const anchorWorld = worldToScreen(zoomed, screenToWorld(baseViewport, anchor));
          expect(anchorWorld.x).toBeCloseTo(anchor.x, 3);
          expect(anchorWorld.y).toBeCloseTo(anchor.y, 3);
        },
      ),
    );
  });

  it('clamps zoomed-in factor at MAX_PIXELS_PER_UNIT', () => {
    const result = zoomAtScreenPoint(baseViewport, screenPoint(400, 300), 1_000_000);
    expect(result.pixelsPerUnit).toBe(MAX_PIXELS_PER_UNIT);
  });

  it('clamps zoomed-out factor at MIN_PIXELS_PER_UNIT', () => {
    const result = zoomAtScreenPoint(baseViewport, screenPoint(400, 300), 0.000001);
    expect(result.pixelsPerUnit).toBe(MIN_PIXELS_PER_UNIT);
  });
});

describe('fitToBounds', () => {
  it('centres the viewport on the bounding box midpoint', () => {
    const result = fitToBounds({ min: worldPoint(0, 0), max: worldPoint(10, 20) }, 1000, 1000);
    expect(result.center.x).toBeCloseTo(5, 10);
    expect(result.center.y).toBeCloseTo(10, 10);
  });

  it('picks the more constraining axis so the whole box fits within the margin', () => {
    // wide box in a narrow-ish viewport: width is the constraining axis.
    const result = fitToBounds({ min: worldPoint(0, 0), max: worldPoint(100, 10) }, 1000, 500, 40);
    const expectedPixelsPerUnit = Math.min((1000 - 80) / 100, (500 - 80) / 10);
    expect(result.pixelsPerUnit).toBeCloseTo(expectedPixelsPerUnit, 10);
  });

  it('never returns a zoom outside the min/max clamp for a degenerate (zero-size) box', () => {
    const result = fitToBounds({ min: worldPoint(5, 5), max: worldPoint(5, 5) }, 800, 600);
    expect(result.pixelsPerUnit).toBeLessThanOrEqual(MAX_PIXELS_PER_UNIT);
    expect(result.pixelsPerUnit).toBeGreaterThanOrEqual(MIN_PIXELS_PER_UNIT);
  });
});

describe('preserveWorldUnderViewportRect', () => {
  /** Where a world point lands on the page, given the surface's own position. */
  function pageOf(
    viewport: Viewport,
    rect: { readonly left: number; readonly top: number },
    world: ReturnType<typeof worldPoint>,
  ): { readonly x: number; readonly y: number } {
    const local = worldToScreen(viewport, world);
    return { x: local.x + rect.left, y: local.y + rect.top };
  }

  it('holds the drawing still when a panel opens and takes width off the left', () => {
    // The regression this exists for. Carrying `center` across unchanged used
    // to slide every wall right by half the panel width under a stationary
    // cursor - no refit, no camera command, but the model moved.
    const before: Viewport = {
      center: worldPoint(0, 0),
      pixelsPerUnit: 2,
      screenWidth: 1000,
      screenHeight: 800,
    };
    const previous = { left: 0, top: 0, width: 1000, height: 800 };
    const next = { left: 300, top: 0, width: 700, height: 800 };
    const wall = worldPoint(120, -45);

    const after = preserveWorldUnderViewportRect(before, previous, next);

    expect(pageOf(after, next, wall).x).toBeCloseTo(pageOf(before, previous, wall).x, 9);
    expect(pageOf(after, next, wall).y).toBeCloseTo(pageOf(before, previous, wall).y, 9);
  });

  it('is not a zoom: scale survives the resize untouched', () => {
    // A resize is not a view command, so it may not refit or rescale.
    const before: Viewport = {
      center: worldPoint(7, -3),
      pixelsPerUnit: 13.5,
      screenWidth: 1200,
      screenHeight: 900,
    };

    const after = preserveWorldUnderViewportRect(
      before,
      { left: 0, top: 0, width: 1200, height: 900 },
      { left: 14, top: 54, width: 880, height: 700 },
    );

    expect(after.pixelsPerUnit).toBe(13.5);
    expect(after.screenWidth).toBe(880);
    expect(after.screenHeight).toBe(700);
  });

  it('keeps the initial fit when there is no previous layout to anchor against', () => {
    // A centre shift computed against a zero-sized surface is arbitrary, and
    // applying one would throw the first fit away before it was ever painted.
    const fitted = fitToBounds({ min: worldPoint(0, 0), max: worldPoint(10, 10) }, 800, 600);

    const after = preserveWorldUnderViewportRect(
      fitted,
      { left: 0, top: 0, width: 0, height: 0 },
      { left: 0, top: 0, width: 800, height: 600 },
    );

    expect(after.center).toEqual(fitted.center);
  });

  it('holds every page point over any surface move or resize', () => {
    fc.assert(
      fc.property(
        fc.double({ min: -500, max: 500, noNaN: true }),
        fc.double({ min: -500, max: 500, noNaN: true }),
        fc.double({ min: 0.5, max: 50, noNaN: true }),
        fc.integer({ min: 1, max: 400 }),
        fc.integer({ min: 1, max: 400 }),
        fc.integer({ min: 200, max: 1600 }),
        fc.integer({ min: 200, max: 1200 }),
        (worldX, worldY, pixelsPerUnit, insetLeft, insetTop, width, height) => {
          const previous = { left: 0, top: 0, width, height };
          // Any surface that moved and shrank: a navigator on the left, an
          // inspector on the right and a project bar above all reduce to this.
          const next = {
            left: insetLeft,
            top: insetTop,
            width: Math.max(1, width - insetLeft),
            height: Math.max(1, height - insetTop),
          };
          const before: Viewport = {
            center: worldPoint(0, 0),
            pixelsPerUnit,
            screenWidth: previous.width,
            screenHeight: previous.height,
          };
          const point = worldPoint(worldX, worldY);

          const after = preserveWorldUnderViewportRect(before, previous, next);

          const expected = pageOf(before, previous, point);
          const actual = pageOf(after, next, point);
          expect(actual.x).toBeCloseTo(expected.x, 6);
          expect(actual.y).toBeCloseTo(expected.y, 6);
        },
      ),
    );
  });

  it('round-trips through screenToWorld, so picking agrees with painting', () => {
    // The half that matters for hit testing: if only painting were corrected,
    // clicks would land on the element that used to be under the cursor.
    const before: Viewport = {
      center: worldPoint(0, 0),
      pixelsPerUnit: 4,
      screenWidth: 1000,
      screenHeight: 800,
    };
    const previous = { left: 0, top: 0, width: 1000, height: 800 };
    const next = { left: 252, top: 68, width: 748, height: 732 };

    const after = preserveWorldUnderViewportRect(before, previous, next);

    // A cursor resting at page (600, 400) throughout.
    const worldBefore = screenToWorld(before, screenPoint(600 - previous.left, 400 - previous.top));
    const worldAfter = screenToWorld(after, screenPoint(600 - next.left, 400 - next.top));

    expect(worldAfter.x).toBeCloseTo(worldBefore.x, 9);
    expect(worldAfter.y).toBeCloseTo(worldBefore.y, 9);
  });
});
