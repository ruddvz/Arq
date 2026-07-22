/**
 * ARQ-122: implement snap glyph rendering.
 *
 * Blueprint section 26 ("Snapping") requirements this covers: "glyph
 * and label" and "zoom-independent screen tolerance." Turns a snap
 * suggestion (source + world point) into renderer-neutral PlanPrimitive
 * entries - a marker shape and a text label naming the snap source -
 * that a PlanRenderer backend (ARQ-119) draws like anything else in a
 * PlanScene.
 *
 * SnapGlyphSource mirrors editor-shell's SnapSource (snap-result.ts,
 * ARQ-045) by value, not by import: this package does not depend on
 * @arq/editor-shell (rendering is consumed by the editor, not the
 * other way around - the same direction every other package boundary
 * in this backlog keeps), so the union is redeclared here, the same
 * "duplicate a small shape rather than reverse a dependency" choice
 * DoorPlacementSide/Hand already made in door-placement-tool.ts. A
 * caller passing an editor-shell SnapResult's `source` field already
 * satisfies this type structurally.
 *
 * Deliberate, documented limitation: every snap source currently gets
 * the same square marker shape, distinguished only by its label text.
 * Distinct per-type glyph shapes (the endpoint/midpoint/centre/etc.
 * pictograms a finished CAD tool shows) are section 20's "custom Arq
 * icon family" - real icon design work with actual visual assets this
 * module has no access to, not something to approximate by guessing
 * shapes. A single, honestly-labelled marker satisfies "glyph and
 * label" without fabricating a polished icon set that does not exist
 * yet; swapping in real per-type icons later only touches this
 * function, not any caller.
 *
 * `sizeWorld` is deliberately a caller-supplied parameter, not a fixed
 * world-space constant: "zoom-independent screen tolerance" means the
 * marker must stay a constant *screen* size regardless of zoom, so the
 * caller converts a fixed screen-pixel size to world units via the
 * current viewport's pixelsPerUnit (screenSizePx / viewport.pixelsPerUnit)
 * before calling this - the same caller-owns-the-viewport-conversion
 * pattern zoom-to-room-gap.ts (ARQ-113) and line-weight.ts (ARQ-120)
 * already establish.
 */

import { worldPoint, type WorldPoint } from '@arq/geometry-2d';
import type { PlanPolygonPrimitive, PlanTextPrimitive } from './plan-scene';

export type SnapGlyphSource =
  | 'endpoint'
  | 'intersection'
  | 'midpoint'
  | 'perpendicular'
  | 'centre'
  | 'grid'
  | 'extension'
  | 'nearest';

/** The label half of section 26's "glyph and label" - one human-readable name per snap source. */
export const SNAP_GLYPH_LABEL: Readonly<Record<SnapGlyphSource, string>> = {
  endpoint: 'Endpoint',
  intersection: 'Intersection',
  midpoint: 'Midpoint',
  perpendicular: 'Perpendicular',
  centre: 'Centre',
  grid: 'Grid',
  extension: 'Extension',
  nearest: 'Nearest',
};

export interface SnapGlyphInput {
  readonly source: SnapGlyphSource;
  readonly point: WorldPoint;
}

export interface SnapGlyphPrimitives<TId> {
  readonly marker: PlanPolygonPrimitive<TId>;
  readonly label: PlanTextPrimitive<TId>;
}

/**
 * Builds the marker + label primitives for a snap suggestion -
 * `glyphId` is whatever id the caller wants these primitives tagged
 * with (snap glyphs are not project elements, so this is not
 * necessarily any Wall/Room id - a caller might use the snap source
 * itself, or a fixed sentinel). Throws for a non-positive/non-finite
 * `sizeWorld` rather than silently drawing a zero-size or
 * inside-out marker.
 */
export function snapGlyphPrimitives<TId>(
  input: SnapGlyphInput,
  glyphId: TId,
  sizeWorld: number,
): SnapGlyphPrimitives<TId> {
  if (!Number.isFinite(sizeWorld) || sizeWorld <= 0) {
    throw new RangeError('sizeWorld must be a positive finite number');
  }
  const { x, y } = input.point;
  const marker: PlanPolygonPrimitive<TId> = {
    kind: 'polygon',
    elementId: glyphId,
    points: [
      worldPoint(x - sizeWorld, y - sizeWorld),
      worldPoint(x + sizeWorld, y - sizeWorld),
      worldPoint(x + sizeWorld, y + sizeWorld),
      worldPoint(x - sizeWorld, y + sizeWorld),
    ],
    styleToken: 'default',
  };
  const label: PlanTextPrimitive<TId> = {
    kind: 'text',
    elementId: glyphId,
    anchor: worldPoint(x + sizeWorld * 1.5, y + sizeWorld * 1.5),
    text: SNAP_GLYPH_LABEL[input.source],
    styleToken: 'default',
  };
  return { marker, label };
}
