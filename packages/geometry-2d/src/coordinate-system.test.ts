import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import {
  screenPoint,
  screenToWorld,
  worldPoint,
  worldToScreen,
  type Viewport,
} from './coordinate-system';

const arbitraryViewport = (): fc.Arbitrary<Viewport> =>
  fc.record({
    center: fc
      .record({
        x: fc.float({ min: -100000, max: 100000, noNaN: true }),
        y: fc.float({ min: -100000, max: 100000, noNaN: true }),
      })
      .map(({ x, y }) => worldPoint(x, y)),
    pixelsPerUnit: fc.float({ min: Math.fround(0.001), max: 1000, noNaN: true }),
    screenWidth: fc.integer({ min: 1, max: 8000 }),
    screenHeight: fc.integer({ min: 1, max: 8000 }),
  });

describe('coordinate-system', () => {
  it('worldToScreen . screenToWorld round-trips for any point and any viewport', () => {
    fc.assert(
      fc.property(
        arbitraryViewport(),
        fc.float({ min: -100000, max: 100000, noNaN: true }),
        fc.float({ min: -100000, max: 100000, noNaN: true }),
        (viewport, x, y) => {
          const original = worldPoint(x, y);
          const roundTripped = screenToWorld(viewport, worldToScreen(viewport, original));
          expect(roundTripped.x).toBeCloseTo(original.x, 3);
          expect(roundTripped.y).toBeCloseTo(original.y, 3);
        },
      ),
    );
  });

  it('renders the viewport centre to the middle of the screen', () => {
    const viewport: Viewport = {
      center: worldPoint(10, 20),
      pixelsPerUnit: 2,
      screenWidth: 900,
      screenHeight: 600,
    };
    const result = worldToScreen(viewport, viewport.center);
    expect(result.x).toBe(450);
    expect(result.y).toBe(300);
  });

  it('flips y between world (y-up) and screen (y-down) space', () => {
    const viewport: Viewport = {
      center: worldPoint(0, 0),
      pixelsPerUnit: 1,
      screenWidth: 100,
      screenHeight: 100,
    };
    // one unit *above* the world origin should render *above* screen centre,
    // i.e. a smaller screen-y (y-down), not a larger one.
    const above = worldToScreen(viewport, worldPoint(0, 1));
    expect(above.y).toBeLessThan(50);
  });

  it('zooming in doubles the screen distance between two world points', () => {
    const base: Viewport = {
      center: worldPoint(0, 0),
      pixelsPerUnit: 1,
      screenWidth: 200,
      screenHeight: 200,
    };
    const zoomed: Viewport = { ...base, pixelsPerUnit: 2 };
    const a = worldToScreen(base, worldPoint(5, 0));
    const b = worldToScreen(zoomed, worldPoint(5, 0));
    const centerX = base.screenWidth / 2;
    expect(Math.abs(b.x - centerX)).toBeCloseTo(2 * Math.abs(a.x - centerX), 5);
  });

  it('screenPoint and worldPoint are not structurally assignable to each other at the type level', () => {
    // This is a compile-time guarantee (branded types), not a runtime one -
    // the following line exists so the test file also documents the intent.
    // @ts-expect-error - a ScreenPoint must not satisfy the WorldPoint shape.
    const wrong: ReturnType<typeof worldPoint> = screenPoint(1, 2);
    expect(wrong).toBeDefined();
  });
});
