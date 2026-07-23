/**
 * ARQ-141: build one plan viewport.
 *
 * Blueprint section 58 ("Sheets")'s "one plan viewport" (v1 sheets have
 * exactly one, ARQ-140's bim-core Sheet schema) needs the plan's model-
 * space geometry (PlanScene, ARQ-119) projected into the sheet's paper
 * space at the viewport's scale and position, ready for a PDF writer
 * (ARQ-142, the very next issue) to draw directly - this module is
 * exactly that projection step, nothing more.
 *
 * `SheetSpacePoint` and `SheetViewportTransform` mirror bim-core's
 * `SheetPoint`/`SheetViewport` (sheet.ts, ARQ-140) by value, not by
 * import: this package does not depend on @arq/bim-core (rendering is
 * consumed by the editor/exporter, not the other way around), the same
 * boundary every other plan-renderer module in this backlog keeps
 * (snap-glyph-rendering.ts's SnapGlyphSource mirroring editor-shell's
 * SnapSource is the same pattern one layer over).
 *
 * A dedicated `SheetPrimitive` union (not a reuse of `PlanPrimitive`)
 * exists because a projected primitive's points are genuinely a
 * different coordinate space - paper space, not @arq/geometry-2d's
 * `WorldPoint` (model space) - and typing them as `WorldPoint` would be
 * exactly the space-conflation bug coordinate-system.ts (ARQ-032)
 * exists to prevent, the same reasoning sheet.ts's own doc comment
 * already applied to `SheetPoint`.
 *
 * The transform itself is a plain uniform scale plus translation - no
 * axis flip. Whether a specific export target (PDF's bottom-left-origin
 * y-up page space, an on-screen sheet preview's y-down space, ...) needs
 * a further flip is that exporter's own concern (ARQ-142), not this
 * projection's - this module only does the one thing every target needs
 * regardless of its own convention: turning model units into paper units
 * at the viewport's chosen scale and position.
 */

import type { WorldPoint } from '@arq/geometry-2d';
import type { PlanPrimitive, PlanScene, StyleToken } from './plan-scene';

export interface SheetSpacePoint {
  readonly x: number;
  readonly y: number;
}

export interface SheetViewportTransform {
  /** Paper units per model unit - must be positive and finite. */
  readonly scale: number;
  /** Paper-space position of the viewport's model-space origin (0, 0). */
  readonly position: SheetSpacePoint;
}

export interface SheetLinePrimitive<TId> {
  readonly kind: 'line';
  readonly elementId: TId;
  readonly points: readonly SheetSpacePoint[];
  readonly styleToken: StyleToken;
}

export interface SheetPolygonPrimitive<TId> {
  readonly kind: 'polygon';
  readonly elementId: TId;
  readonly points: readonly SheetSpacePoint[];
  readonly styleToken: StyleToken;
}

export interface SheetTextPrimitive<TId> {
  readonly kind: 'text';
  readonly elementId: TId;
  readonly anchor: SheetSpacePoint;
  readonly text: string;
  readonly styleToken: StyleToken;
}

export interface SheetHandlePrimitive<TId> {
  readonly kind: 'handle';
  readonly elementId: TId;
  readonly point: SheetSpacePoint;
  readonly styleToken: StyleToken;
}

export type SheetPrimitive<TId> =
  | SheetLinePrimitive<TId>
  | SheetPolygonPrimitive<TId>
  | SheetTextPrimitive<TId>
  | SheetHandlePrimitive<TId>;

export interface SheetViewportScene<TId> {
  readonly primitives: readonly SheetPrimitive<TId>[];
}

export function projectPointToSheet(
  point: WorldPoint,
  transform: SheetViewportTransform,
): SheetSpacePoint {
  return {
    x: transform.position.x + point.x * transform.scale,
    y: transform.position.y + point.y * transform.scale,
  };
}

function projectPrimitiveToSheet<TId>(
  primitive: PlanPrimitive<TId>,
  transform: SheetViewportTransform,
): SheetPrimitive<TId> {
  switch (primitive.kind) {
    case 'line':
      return {
        kind: 'line',
        elementId: primitive.elementId,
        points: primitive.points.map((point) => projectPointToSheet(point, transform)),
        styleToken: primitive.styleToken,
      };
    case 'polygon':
      return {
        kind: 'polygon',
        elementId: primitive.elementId,
        points: primitive.points.map((point) => projectPointToSheet(point, transform)),
        styleToken: primitive.styleToken,
      };
    case 'text':
      return {
        kind: 'text',
        elementId: primitive.elementId,
        anchor: projectPointToSheet(primitive.anchor, transform),
        text: primitive.text,
        styleToken: primitive.styleToken,
      };
    case 'handle':
      return {
        kind: 'handle',
        elementId: primitive.elementId,
        point: projectPointToSheet(primitive.point, transform),
        styleToken: primitive.styleToken,
      };
  }
}

/**
 * Builds a sheet's single plan viewport: projects every primitive in
 * `scene` (model space) into paper space via `transform`. Throws for a
 * non-positive/non-finite `transform.scale` rather than silently
 * producing a zero-size or inside-out viewport.
 */
export function buildPlanViewport<TId>(
  scene: PlanScene<TId>,
  transform: SheetViewportTransform,
): SheetViewportScene<TId> {
  if (!Number.isFinite(transform.scale) || transform.scale <= 0) {
    throw new RangeError('transform.scale must be a positive finite number');
  }
  return {
    primitives: scene.primitives.map((primitive) => projectPrimitiveToSheet(primitive, transform)),
  };
}
