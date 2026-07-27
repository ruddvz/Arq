/**
 * ADR-0008: Canvas 2D as the v1 PlanScene renderer backend. ARQ-115's
 * benchmark spike proved Canvas 2D clears the pan/zoom performance target
 * against a synthetic throwaway scene - it never painted a real PlanScene
 * (ARQ-119) or projected through a real Viewport (@arq/geometry-2d's
 * worldToScreen, ARQ-032). This module is that backend, built for real.
 *
 * Colour resolution is limited to the two colours design/tokens/brand.v4.json
 * actually defines (black, phthalo green). Every other state distinction
 * follows docs/design/DESIGN-SYSTEM.md's rule - "Status must use icon, text,
 * pattern and line treatment. Hue cannot be the only signal." - so section
 * 18's states are differentiated by line weight and dash pattern
 * (lineTreatmentForToken below), monochrome by design rather than by gap.
 */

import { worldToScreen, type Viewport, type WorldPoint } from '@arq/geometry-2d';
import type { PlanPrimitive, PlanScene, StyleToken } from './plan-scene';
import { lineWeightToDevicePixels, type LineWeight } from './line-weight';

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
    case 'proposed':
      return BRAND_PHTHALO_GREEN;
    case 'default':
    case 'hover':
    case 'locked':
    case 'warning':
    case 'error':
    case 'imported':
      return BRAND_BLACK;
  }
}

export interface LineTreatment {
  readonly weight: LineWeight;
  /** Dash pattern in CSS pixels (scaled by devicePixelRatio at paint time); empty = solid. */
  readonly dashCssPx: readonly number[];
}

/**
 * Section 18's state language rendered per DESIGN-SYSTEM.md's monochrome
 * rule: each state is legible from weight + pattern alone. Selection keeps
 * its familiar pair (primary solid/medium, secondary dashed); status states
 * are black with distinct patterns - warning dash-dot, error heavy short
 * dash, imported a fine provenance dash, locked a long quiet dash; hover is
 * a weight change only; proposed (an uncommitted AI/preview state) is
 * dotted, in the same green as the other not-yet-committed treatments.
 */
export function lineTreatmentForToken(token: StyleToken): LineTreatment {
  switch (token) {
    case 'default':
      return { weight: 'regular', dashCssPx: [] };
    case 'hover':
      return { weight: 'medium', dashCssPx: [] };
    case 'active-tool':
      return { weight: 'regular', dashCssPx: [] };
    case 'selected-primary':
      return { weight: 'medium', dashCssPx: [] };
    case 'selected-secondary':
      return { weight: 'regular', dashCssPx: [4, 4] };
    case 'locked':
      return { weight: 'hairline', dashCssPx: [8, 4] };
    case 'warning':
      return { weight: 'medium', dashCssPx: [6, 3, 1.5, 3] };
    case 'error':
      return { weight: 'heavy', dashCssPx: [3, 3] };
    case 'imported':
      return { weight: 'hairline', dashCssPx: [2, 2] };
    case 'proposed':
      return { weight: 'regular', dashCssPx: [1, 3] };
  }
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
      const treatment = lineTreatmentForToken(primitive.styleToken);
      target.strokeStyle = strokeColorForToken(primitive.styleToken);
      target.lineWidth = lineWeightToDevicePixels(treatment.weight, devicePixelRatio);
      target.setLineDash(treatment.dashCssPx.map((dash) => dash * devicePixelRatio));
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
