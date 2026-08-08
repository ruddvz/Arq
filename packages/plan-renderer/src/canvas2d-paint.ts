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
import { hatchSegments } from './room-hatch';

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
  // `strokeText` and `lineJoin` are here only for the halo behind label text -
  // see `paintTextWithHalo`. Nothing else in this backend strokes text.
  | 'strokeText'
  | 'arc'
  | 'setLineDash'
  | 'strokeStyle'
  | 'fillStyle'
  | 'lineWidth'
  | 'lineJoin'
  | 'font'
>;

const BRAND_BLACK = '#000000';
const BRAND_PHTHALO_GREEN = '#0B6B50';
const HANDLE_RADIUS_CSS_PX = 4;

/**
 * Leading between the lines of a multi-line primitive, in CSS pixels. A
 * constant rather than a read of the canvas font because the target is an
 * interface, not necessarily a real 2D context - the same reason line weights
 * are passed in rather than measured.
 */
const TEXT_LINE_HEIGHT_PX = 12;

/**
 * Width of the paper-coloured halo drawn behind label text, in CSS pixels.
 *
 * A drawn plan does not move a room's name off its furniture; it knocks the
 * furniture out from behind the name. Until the plan carried furniture there
 * was nothing to knock out, and "Kitchen 35.3 m²" printed over the kitchen
 * island the moment there was one - the label and the island both legible
 * alone, neither legible together.
 *
 * Two pixels a side. Less does not separate the text from linework crossing it;
 * more starts eating the drawing around short labels, which trades one
 * unreadable thing for another.
 */
const TEXT_HALO_CSS_PX = 2;

/**
 * One line of label text, knocked out of whatever is behind it.
 *
 * The halo is a stroke of the same glyphs in the paper colour, drawn first and
 * filled over - the standard way a drawing puts text on top of linework without
 * a rectangle around it. A rectangle would be simpler and worse: it clears the
 * label's whole bounding box, including the corners the letters never reach, so
 * a two-word room name punches a visible white slab out of the plan.
 *
 * `lineJoin` is round because the default mitre spikes on the sharp interior
 * angles of letterforms - a capital A grows horns at this stroke width.
 *
 * The paper colour rather than white: under a dark appearance the surface
 * behind the drawing is dark, and a white halo would be the brightest thing on
 * the page.
 */
function paintTextWithHalo(
  target: Canvas2dPaintTarget,
  text: string,
  x: number,
  y: number,
  haloColor: string,
  haloWidth: number,
): void {
  target.strokeStyle = haloColor;
  target.lineWidth = haloWidth;
  target.lineJoin = 'round';
  target.strokeText(text, x, y);
  target.lineJoin = 'miter';
  target.fillText(text, x, y);
}

/**
 * The two colours the plan is drawn in, and the one it is drawn on.
 *
 * The renderer used to hard-code black ink and a white handle fill, which is
 * correct on paper and wrong on a dark drawing surface: under ADR-0032's dark
 * appearance the linework stayed black on a near-black background and the plan
 * simply disappeared. Passing the palette in keeps this module pure - it still
 * decides nothing about appearance, it is just no longer asserting one.
 */
/**
 * Hatch pitch in world millimetres.
 *
 * Close enough to read as a material, open enough not to grey the room out.
 * In world units rather than screen pixels, so a courtyard hatched at 400mm
 * stays hatched at 400mm when the drawing is zoomed - hatching is part of the
 * drawing, not a texture laid over it.
 */
const HATCH_SPACING_MM = 400;

/** Forty-five degrees, the convention for an unspecified hatch on a plan. */
const HATCH_ANGLE = Math.PI / 4;

export interface PlanPalette {
  /** Linework and text. `--arq-ui-ink` resolved for the current appearance. */
  readonly ink: string;
  /** The surface the plan sits on, used for handle fills so they read as holes. */
  readonly paper: string;
  /** Selection, active tool and proposal states. */
  readonly accent: string;
  /**
   * The solid a wall is filled with where the section plane cuts it. Optional
   * so a caller that has not chosen one still gets the outline-only drawing it
   * had before, rather than a wall filled with a colour nobody picked.
   */
  readonly poche?: string;
  /** The tint that makes an enclosed area read as a room. */
  readonly roomFill?: string;
  /**
   * A tint per room category, keyed by `RoomTint`. Absent keys fall back to
   * `roomFill`, so a palette that names none of them still draws every room -
   * one wash instead of several, which is what this looked like before.
   */
  readonly roomFills?: Readonly<Record<string, string>>;
  /**
   * Tints whose rooms are hatched as well as filled, keyed by `RoomTint`, with
   * the colour to draw the hatching in.
   *
   * A drawn plan hatches what is not floor. The golden fixture's open courtyard
   * is outdoors, and a flat tint says "another room in a slightly different
   * colour" where a hatch says "you are outside" - a distinction a reader makes
   * without a legend and without having to tell two pale greens apart, which is
   * also why it is not left to the tint alone.
   *
   * Absent means no room is hatched, which is what this drew before.
   */
  readonly roomHatches?: Readonly<Record<string, string>>;
}

/** Light appearance, and the exact colours this renderer drew before it took a palette. */
export const DEFAULT_PLAN_PALETTE: PlanPalette = {
  ink: BRAND_BLACK,
  paper: '#ffffff',
  accent: BRAND_PHTHALO_GREEN,
};

function strokeColorForToken(token: StyleToken, palette: PlanPalette): string {
  switch (token) {
    case 'selected-primary':
    case 'selected-secondary':
    case 'active-tool':
    case 'proposed':
      return palette.accent;
    case 'default':
    case 'hover':
    case 'locked':
    case 'warning':
    case 'error':
    case 'imported':
      return palette.ink;
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

function fillWorldPolygon(
  target: Canvas2dPaintTarget,
  viewport: Viewport,
  points: readonly WorldPoint[],
): void {
  if (points.length < 3) {
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
  target.closePath();
  target.fill();
}

function paintPrimitive<TId>(
  target: Canvas2dPaintTarget,
  viewport: Viewport,
  devicePixelRatio: number,
  primitive: PlanPrimitive<TId>,
  palette: PlanPalette,
): void {
  switch (primitive.kind) {
    case 'line':
    case 'polygon': {
      const treatment = lineTreatmentForToken(primitive.styleToken);
      /*
       * Filled first, then stroked, so the outline sits on top of its own fill
       * rather than being half-covered by it. A fill the palette has no colour
       * for is skipped rather than defaulted: an unasked-for colour on a wall
       * is worse than no colour at all.
       */
      if (primitive.kind === 'polygon' && primitive.fill !== undefined) {
        const colour =
          primitive.fill === 'poche'
            ? palette.poche
            : primitive.fillTint === undefined
              ? palette.roomFill
              : (palette.roomFills?.[primitive.fillTint] ?? palette.roomFill);
        if (colour !== undefined) {
          target.setLineDash([]);
          target.fillStyle = colour;
          fillWorldPolygon(target, viewport, primitive.points);
        }
        /*
         * Hatching goes on after the fill and before the outline, which is the
         * order a drawing is built: the wash, then the material, then the edges
         * that contain both.
         *
         * Computed as segments rather than painted as a pattern because
         * `Canvas2dPaintTarget` carries no `clip` or `createPattern` - see
         * `room-hatch.ts` for why that is the cheaper answer rather than a
         * limitation worked around. The spacing is in world units, so the hatch
         * is a property of the building and scales with the drawing instead of
         * behaving like a screen texture.
         */
        const hatch =
          primitive.fillTint === undefined ? undefined : palette.roomHatches?.[primitive.fillTint];
        if (hatch !== undefined) {
          target.setLineDash([]);
          target.strokeStyle = hatch;
          target.lineWidth = lineWeightToDevicePixels('hairline', devicePixelRatio);
          for (const segment of hatchSegments(primitive.points, HATCH_SPACING_MM, HATCH_ANGLE)) {
            strokeWorldPolyline(target, viewport, [segment.start, segment.end], false);
          }
        }
      }
      target.strokeStyle = strokeColorForToken(primitive.styleToken, palette);
      target.lineWidth = lineWeightToDevicePixels(treatment.weight, devicePixelRatio);
      target.setLineDash(treatment.dashCssPx.map((dash) => dash * devicePixelRatio));
      strokeWorldPolyline(target, viewport, primitive.points, primitive.kind === 'polygon');
      break;
    }
    case 'text': {
      target.setLineDash([]);
      target.fillStyle = strokeColorForToken(primitive.styleToken, palette);
      const screen = worldToScreen(viewport, primitive.anchor);
      /*
       * Drawn line by line. `fillText` renders a newline as a space, so a room
       * label built as "name\narea" - which `buildRoomLabelPrimitive` has
       * produced since it was written - came out as one long line twice as wide
       * as it should be, which is most of why labels collided at small scales.
       *
       * Centred vertically on the anchor so a two-line label sits on the point
       * it was anchored to rather than hanging below it.
       */
      const lines = primitive.text.split('\n');
      const haloColor = palette.paper;
      const haloWidth = TEXT_HALO_CSS_PX * 2 * devicePixelRatio;
      if (lines.length === 1) {
        paintTextWithHalo(target, primitive.text, screen.x, screen.y, haloColor, haloWidth);
        break;
      }
      const lineHeight = TEXT_LINE_HEIGHT_PX * devicePixelRatio;
      const firstOffset = -((lines.length - 1) * lineHeight) / 2;
      lines.forEach((line, index) => {
        paintTextWithHalo(
          target,
          line,
          screen.x,
          screen.y + firstOffset + index * lineHeight,
          haloColor,
          haloWidth,
        );
      });
      break;
    }
    case 'handle': {
      // Section 18: handles are a paper-fill/ink-border disc, a fixed visual
      // independent of styleToken - unlike lines/polygons/text above. Filled
      // with the surface colour rather than literal white so the disc still
      // reads as a hole punched in the drawing under a dark appearance.
      target.setLineDash([]);
      const screen = worldToScreen(viewport, primitive.point);
      const radius = HANDLE_RADIUS_CSS_PX * devicePixelRatio;
      target.beginPath();
      target.arc(screen.x, screen.y, radius, 0, Math.PI * 2);
      target.closePath();
      target.fillStyle = palette.paper;
      target.fill();
      target.strokeStyle = palette.ink;
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
  palette: PlanPalette = DEFAULT_PLAN_PALETTE,
): void {
  if (!Number.isFinite(devicePixelRatio) || devicePixelRatio <= 0) {
    throw new RangeError('devicePixelRatio must be a positive finite number');
  }
  for (const primitive of scene.primitives) {
    paintPrimitive(target, viewport, devicePixelRatio, primitive, palette);
  }
}
