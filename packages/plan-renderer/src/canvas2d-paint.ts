/**
 * ADR-0008: Canvas 2D as the v1 PlanScene renderer backend. ARQ-115's
 * benchmark spike proved Canvas 2D clears the pan/zoom performance target
 * against a synthetic throwaway scene - it never painted a real PlanScene
 * (ARQ-119) or projected through a real Viewport (@arq/geometry-2d's
 * worldToScreen, ARQ-032). This module is that backend, built for real.
 *
 * Colour resolution is limited to the two colours design/tokens/brand.v4.json
 * actually defines (black, phthalo green): section 18's hover/warning/error/
 * imported/proposed states have no assigned colour yet, so they fall back to
 * the default (black) stroke rather than inventing an unapproved hex value -
 * a documented gap, not an oversight.
 */

import { worldToScreen, type Viewport, type WorldPoint } from '@arq/geometry-2d';
import type { PlanPrimitive, PlanScene, StyleToken } from './plan-scene';
import { lineWeightToDevicePixels } from './line-weight';

/** The subset of CanvasRenderingContext2D this backend actually uses - lets tests pass a plain recording fake instead of a real DOM canvas. */
export type Canvas2dPaintTarget = Pick<
  CanvasRenderingContext2D,
  | 'beginPath'
  | 'moveTo'
  | 'lineTo'
  | 'closePath'
  | 'stroke'
  | 'fill'
  | 'fillText'
  | 'arc'
  | 'setLineDash'
  | 'strokeStyle'
  | 'fillStyle'
  | 'lineWidth'
  | 'font'
>;

const BRAND_BLACK = '#000000';
const BRAND_PHTHALO_GREEN = '#0B6B50';
const HANDLE_RADIUS_CSS_PX = 4;

function strokeColorForToken(token: StyleToken): string {
  switch (token) {
    case 'selected-primary':
    case 'selected-secondary':
    case 'active-tool':
      return BRAND_PHTHALO_GREEN;
    case 'default':
    case 'hover':
    case 'locked':
    case 'warning':
    case 'error':
    case 'imported':
    case 'proposed':
      return BRAND_BLACK;
  }
}

/** Section 18: selected-primary is a solid outline, selected-secondary is dashed. */
function isDashedToken(token: StyleToken): boolean {
  return token === 'selected-secondary';
}

function strokeWorldPolyline(
  target: Canvas2dPaintTarget,
  viewport: Viewport,
  points: readonly WorldPoint[],
  close: boolean,
): void {
  if (points.length === 0) {
    return;
  }
  target.beginPath();
  points.forEach((point, index) => {
    const screen = worldToScreen(viewport, point);
    if (index === 0) {
      target.moveTo(screen.x, screen.y);
    } else {
      target.lineTo(screen.x, screen.y);
    }
  });
  if (close) {
    target.closePath();
  }
  target.stroke();
}

function paintPrimitive<TId>(
  target: Canvas2dPaintTarget,
  viewport: Viewport,
  devicePixelRatio: number,
  primitive: PlanPrimitive<TId>,
): void {
  switch (primitive.kind) {
    case 'line':
    case 'polygon': {
      target.strokeStyle = strokeColorForToken(primitive.styleToken);
      target.lineWidth = lineWeightToDevicePixels('regular', devicePixelRatio);
      target.setLineDash(
        isDashedToken(primitive.styleToken) ? [4 * devicePixelRatio, 4 * devicePixelRatio] : [],
      );
      strokeWorldPolyline(target, viewport, primitive.points, primitive.kind === 'polygon');
      break;
    }
    case 'text': {
      target.setLineDash([]);
      target.fillStyle = strokeColorForToken(primitive.styleToken);
      const screen = worldToScreen(viewport, primitive.anchor);
      target.fillText(primitive.text, screen.x, screen.y);
      break;
    }
    case 'handle': {
      // Section 18: handles are always drawn white-fill/black-border, a fixed
      // visual independent of styleToken - unlike lines/polygons/text above.
      target.setLineDash([]);
      const screen = worldToScreen(viewport, primitive.point);
      const radius = HANDLE_RADIUS_CSS_PX * devicePixelRatio;
      target.beginPath();
      target.arc(screen.x, screen.y, radius, 0, Math.PI * 2);
      target.closePath();
      target.fillStyle = '#ffffff';
      target.fill();
      target.strokeStyle = BRAND_BLACK;
      target.lineWidth = lineWeightToDevicePixels('hairline', devicePixelRatio);
      target.stroke();
      break;
    }
  }
}

/**
 * Paints every primitive in `scene` onto `target`, projecting each point from
 * world space to screen space via `viewport` (@arq/geometry-2d's
 * worldToScreen, ARQ-032). Does not clear the canvas first, and does not
 * manage devicePixelRatio scaling of the canvas backing store itself - both
 * are the caller's responsibility, matching how lineWeightToDevicePixels
 * already pushes that same responsibility to its own caller.
 */
export function paintPlanScene<TId>(
  target: Canvas2dPaintTarget,
  viewport: Viewport,
  devicePixelRatio: number,
  scene: PlanScene<TId>,
): void {
  if (!Number.isFinite(devicePixelRatio) || devicePixelRatio <= 0) {
    throw new RangeError('devicePixelRatio must be a positive finite number');
  }
  for (const primitive of scene.primitives) {
    paintPrimitive(target, viewport, devicePixelRatio, primitive);
  }
}
