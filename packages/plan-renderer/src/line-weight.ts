/**
 * ARQ-120: implement stable line weights.
 *
 * "Stable" here means what a drafter would expect from any technical
 * drawing tool: a line's weight tier (hairline through heavy) reads as
 * a consistent, crisp on-screen thickness - it does not blur
 * unpredictably as the device pixel ratio changes, and it does not
 * silently vanish to sub-pixel invisibility at a high device pixel
 * ratio. This is a screen-space concept, deliberately independent of
 * the current viewport zoom (pixelsPerUnit, @arq/geometry-2d ARQ-032/033):
 * a wall's *geometric* thickness already scales with zoom because it is
 * drawn as a filled polygon in world units (wall-outline.ts, ARQ-093) -
 * line weight is about annotation/linework hierarchy (a thin dimension
 * line vs. a heavier poché boundary), which stays legible at a fixed
 * screen size the same way it would on a printed sheet at its own
 * scale. Print/PDF-accurate line-weight-to-paper-scale conversion is a
 * separate, later concern (blueprint section 59, PDF export) - out of
 * scope here.
 *
 * Kept renderer-independent on purpose (no Canvas 2D/PixiJS import):
 * lineWeightToDevicePixels and snapStrokeCenter are pure functions any
 * PlanRenderer backend (plan-renderer.ts, ARQ-119) can call while
 * preparing to draw a stroke, not something baked into one backend.
 */

export type LineWeight = 'hairline' | 'thin' | 'regular' | 'medium' | 'heavy';

/**
 * Canonical CSS-pixel width per tier, before device-pixel-ratio
 * scaling - a fixed on-screen hierarchy, independent of zoom. Each
 * tier is already at least 1 CSS pixel so the hierarchy stays visually
 * distinct even at the lowest supported devicePixelRatio (1) - see
 * lineWeightToDevicePixels's 1-device-pixel floor, which exists for a
 * devicePixelRatio *below* 1, not to rescue values chosen here.
 */
export const LINE_WEIGHT_CSS_PX: Readonly<Record<LineWeight, number>> = {
  hairline: 1,
  thin: 1.5,
  regular: 2,
  medium: 3,
  heavy: 4,
};

/**
 * Converts a LineWeight tier to an actual device-pixel stroke width for
 * the given devicePixelRatio, floored at 1 device pixel - a stroke
 * thinner than one physical pixel does not render as "thinner," it
 * renders as inconsistently-anti-aliased or invisible, which is
 * exactly the instability this issue exists to prevent.
 */
export function lineWeightToDevicePixels(weight: LineWeight, devicePixelRatio: number): number {
  if (!Number.isFinite(devicePixelRatio) || devicePixelRatio <= 0) {
    throw new RangeError('devicePixelRatio must be a positive finite number');
  }
  const devicePixels = LINE_WEIGHT_CSS_PX[weight] * devicePixelRatio;
  return Math.max(1, devicePixels);
}

/**
 * The classic canvas crisp-line technique: given where a stroke's
 * center would naturally fall (in device pixels) and its device-pixel
 * width, returns the coordinate to actually draw at so the stroke lands
 * on exact physical pixel boundaries instead of straddling two rows/
 * columns and anti-aliasing into a blur. An odd-device-pixel-width
 * stroke snaps its center to a half-pixel boundary (n + 0.5); an even
 * width snaps to a whole-pixel boundary - both are snapped to the
 * *nearest* such boundary, so the line moves as little as possible from
 * its true position.
 */
export function snapStrokeCenter(coordinateDevicePx: number, widthDevicePx: number): number {
  const isOddWidth = Math.round(widthDevicePx) % 2 === 1;
  return isOddWidth
    ? Math.round(coordinateDevicePx - 0.5) + 0.5
    : Math.round(coordinateDevicePx);
}
