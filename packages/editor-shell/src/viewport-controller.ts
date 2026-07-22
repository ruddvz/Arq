/**
 * ARQ-033: pan and zoom.
 *
 * Pure, framework-agnostic viewport state + transitions, built on
 * @arq/geometry-2d's Viewport/world-screen transform (ARQ-032). Kept free of
 * any rendering or input-library dependency on purpose - no frontend
 * framework is chosen yet (see open-source/TECHNOLOGY-MATRIX.csv), and the
 * input abstraction itself is a separate, later issue (ARQ-035/036/037).
 * This module only answers "given an intent (pan by dx/dy, zoom at a
 * point), what is the new viewport" - wiring actual pointer/wheel/touch
 * events to these functions is out of scope here.
 */

import { screenToWorld, worldToScreen, type Viewport, type WorldPoint } from '@arq/geometry-2d';

export const MIN_PIXELS_PER_UNIT = 0.01;
export const MAX_PIXELS_PER_UNIT = 10000;

function clampZoom(pixelsPerUnit: number): number {
  return Math.min(MAX_PIXELS_PER_UNIT, Math.max(MIN_PIXELS_PER_UNIT, pixelsPerUnit));
}

/**
 * Pan by a screen-space delta (for example, from a pointer-move or a
 * two-finger drag). The world point currently under the pointer is not
 * preserved by pan - that is zoom-at-point's job, not pan's.
 */
export function panByScreenDelta(viewport: Viewport, dxScreen: number, dyScreen: number): Viewport {
  return {
    ...viewport,
    center: {
      x: (viewport.center.x - dxScreen / viewport.pixelsPerUnit) as WorldPoint['x'],
      // screen space is y-down, world space is y-up (see coordinate-system.ts) -
      // a positive screen-y drag must move the world centre in the
      // corresponding, opposite-signed world-y direction.
      y: (viewport.center.y + dyScreen / viewport.pixelsPerUnit) as WorldPoint['y'],
    },
  };
}

/**
 * Zoom by `factor` (>1 zooms in, <1 zooms out) while keeping the world point
 * currently under `anchorScreen` visually fixed - the standard "zoom under
 * the cursor" behaviour, not zoom-toward-the-viewport-centre.
 */
export function zoomAtScreenPoint(
  viewport: Viewport,
  anchorScreen: Parameters<typeof screenToWorld>[1],
  factor: number,
): Viewport {
  if (!Number.isFinite(factor) || factor <= 0) {
    throw new RangeError('zoom factor must be a positive finite number');
  }
  const anchorWorldBefore = screenToWorld(viewport, anchorScreen);
  const zoomed: Viewport = {
    ...viewport,
    pixelsPerUnit: clampZoom(viewport.pixelsPerUnit * factor),
  };
  const anchorScreenAfter = worldToScreen(zoomed, anchorWorldBefore);
  // re-centre so the anchor point lands back where it started on screen.
  return panByScreenDelta(
    zoomed,
    anchorScreen.x - anchorScreenAfter.x,
    anchorScreen.y - anchorScreenAfter.y,
  );
}

/**
 * Frame a world-space bounding box entirely within the screen, centred,
 * with the given margin (in screen pixels) on every side - the "fit to
 * selection" / "fit view" behaviour.
 */
export function fitToBounds(
  bounds: { readonly min: WorldPoint; readonly max: WorldPoint },
  screenWidth: number,
  screenHeight: number,
  marginPx = 40,
): Viewport {
  const worldWidth = Math.max(bounds.max.x - bounds.min.x, Number.EPSILON);
  const worldHeight = Math.max(bounds.max.y - bounds.min.y, Number.EPSILON);
  const availableWidth = Math.max(screenWidth - 2 * marginPx, 1);
  const availableHeight = Math.max(screenHeight - 2 * marginPx, 1);
  const pixelsPerUnit = clampZoom(
    Math.min(availableWidth / worldWidth, availableHeight / worldHeight),
  );
  return {
    center: {
      x: ((bounds.min.x + bounds.max.x) / 2) as WorldPoint['x'],
      y: ((bounds.min.y + bounds.max.y) / 2) as WorldPoint['y'],
    },
    pixelsPerUnit,
    screenWidth,
    screenHeight,
  };
}
