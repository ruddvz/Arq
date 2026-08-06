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

/** Where the drawing surface sits, in the same pixel space as `Viewport.screenWidth`. */
export interface ViewportRect {
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
}

/**
 * Keep the drawing visually still when the surface itself is resized or moved.
 *
 * The case this exists for: a docked panel opens and takes 300px off the left
 * of the canvas. Carrying `center` across unchanged - the obvious thing, and
 * what the plan surface did before this - keeps the world point at the canvas
 * *centre* fixed. But the canvas centre just moved 150px right on screen, so
 * every wall slides 150px right under a stationary cursor. Nothing refitted and
 * no camera command ran, yet the drawing moved, which is what a user
 * experiences as the model jumping when they open a panel.
 *
 * What must actually be held constant is the mapping from a *page* pixel to a
 * world point. Since screen coordinates here are surface-local, that mapping
 * depends on where the surface sits as well as how big it is, so the centre has
 * to move by exactly as much as the surface's own centre did.
 *
 * Deliberately not a fit or a zoom: `pixelsPerUnit` is untouched, so scale is
 * preserved as well as position. A resize is not a view command.
 */
export function preserveWorldUnderViewportRect(
  viewport: Viewport,
  previous: ViewportRect,
  next: ViewportRect,
): Viewport {
  const resized: Viewport = {
    ...viewport,
    screenWidth: next.width,
    screenHeight: next.height,
  };

  // Before the first real layout there is no anchor to preserve: any centre
  // shift computed against a zero-sized surface is arbitrary, and applying one
  // would throw the initial fit away.
  if (previous.width <= 0 || previous.height <= 0 || !Number.isFinite(viewport.pixelsPerUnit)) {
    return resized;
  }

  const dxScreen = next.left + next.width / 2 - (previous.left + previous.width / 2);
  const dyScreen = next.top + next.height / 2 - (previous.top + previous.height / 2);

  return {
    ...resized,
    center: {
      x: (viewport.center.x + dxScreen / viewport.pixelsPerUnit) as WorldPoint['x'],
      // Screen y is down and world y is up, so the surface moving down the page
      // means the world centre moves the other way.
      y: (viewport.center.y - dyScreen / viewport.pixelsPerUnit) as WorldPoint['y'],
    },
  };
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
