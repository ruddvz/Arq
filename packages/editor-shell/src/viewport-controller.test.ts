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
