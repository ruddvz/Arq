/**
 * ARQ-154: test 200 percent zoom.
 *
 * Blueprint section 126 ("Baseline")'s accessibility requirement "200%
 * browser zoom" - distinct from the editor's own canvas pan/zoom
 * (`Viewport.pixelsPerUnit`, @arq/geometry-2d ARQ-032/033), which is a
 * deliberate user action inside the drawing; browser/OS page zoom is
 * an assistive-technology feature a low-vision user turns on for the
 * whole page, including Arq's canvas.
 *
 * The standard way a canvas stays crisp under browser zoom is scaling
 * its backing store by `window.devicePixelRatio`, which a 200% browser
 * zoom roughly doubles from whatever it already was (this repository
 * has no real page/canvas-mounting code yet to read that value from -
 * see this module's own doc note below on what remains untested until
 * one exists). What line-weight.ts (ARQ-120) already promises - "a
 * line's weight tier reads as a consistent, crisp on-screen thickness...
 * does not blur unpredictably as the device pixel ratio changes" - is
 * exactly the guarantee 200% zoom depends on, so this module verifies
 * that guarantee explicitly at devicePixelRatio values a 200%-zoomed
 * page would actually produce, rather than only the arbitrary DPR
 * values line-weight.test.ts's own unit tests happened to pick.
 */

import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { lineWeightToDevicePixels, type LineWeight } from './line-weight';
import { worldToScreen, screenToWorld, worldPoint, type Viewport } from '@arq/geometry-2d';

const ALL_TIERS: readonly LineWeight[] = ['hairline', 'thin', 'regular', 'medium', 'heavy'];

describe('line weight stability under 200% browser zoom', () => {
  it('keeps every tier at or above 1 device pixel at devicePixelRatio 2 (a typical 100%-zoom baseline doubled to 200%)', () => {
    for (const tier of ALL_TIERS) {
      expect(lineWeightToDevicePixels(tier, 2)).toBeGreaterThanOrEqual(1);
    }
  });

  it('keeps the tier hierarchy strictly monotonic at devicePixelRatio 2', () => {
    const widths = ALL_TIERS.map((tier) => lineWeightToDevicePixels(tier, 2));
    for (let i = 1; i < widths.length; i += 1) {
      expect(widths[i]!).toBeGreaterThan(widths[i - 1]!);
    }
  });

  it('keeps the tier hierarchy strictly monotonic across the realistic browser-zoom range (100% through 400%, i.e. devicePixelRatio 1 through 4)', () => {
    fc.assert(
      fc.property(fc.float({ min: 1, max: 4, noNaN: true }), (devicePixelRatio) => {
        const widths = ALL_TIERS.map((tier) => lineWeightToDevicePixels(tier, devicePixelRatio));
        for (let i = 1; i < widths.length; i += 1) {
          expect(widths[i]!).toBeGreaterThan(widths[i - 1]!);
        }
      }),
    );
  });
});

describe('world/screen coordinate round-trip under a 200%-zoomed viewport', () => {
  it('round-trips exactly when the effective CSS viewport is halved (the same physical screen space at 200% zoom shows half as many CSS pixels)', () => {
    const viewportAt100: Viewport = {
      center: worldPoint(1000, 2000),
      pixelsPerUnit: 2,
      screenWidth: 1600,
      screenHeight: 1000,
    };
    const viewportAt200: Viewport = {
      ...viewportAt100,
      screenWidth: viewportAt100.screenWidth / 2,
      screenHeight: viewportAt100.screenHeight / 2,
    };
    const original = worldPoint(1234, -567);
    const screen = worldToScreen(viewportAt200, original);
    const roundTripped = screenToWorld(viewportAt200, screen);
    expect(roundTripped.x).toBeCloseTo(original.x, 9);
    expect(roundTripped.y).toBeCloseTo(original.y, 9);
  });

  it('property: world/screen round-trip stays exact across any viewport size a browser zoom level between 50% and 400% could produce', () => {
    fc.assert(
      fc.property(
        fc.float({ min: Math.fround(400), max: Math.fround(3200), noNaN: true }),
        fc.float({ min: Math.fround(300), max: Math.fround(2000), noNaN: true }),
        fc.float({ min: Math.fround(0.1), max: Math.fround(10), noNaN: true }),
        fc.float({ min: Math.fround(-100000), max: Math.fround(100000), noNaN: true }),
        fc.float({ min: Math.fround(-100000), max: Math.fround(100000), noNaN: true }),
        (screenWidth, screenHeight, pixelsPerUnit, x, y) => {
          const viewport: Viewport = {
            center: worldPoint(0, 0),
            pixelsPerUnit,
            screenWidth,
            screenHeight,
          };
          const original = worldPoint(x, y);
          const roundTripped = screenToWorld(viewport, worldToScreen(viewport, original));
          expect(roundTripped.x).toBeCloseTo(original.x, 3);
          expect(roundTripped.y).toBeCloseTo(original.y, 3);
        },
      ),
    );
  });
});
