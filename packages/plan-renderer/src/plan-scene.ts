/**
 * ARQ-119: implement plan scene abstraction.
 *
 * Blueprint section 60 ("Rendering architecture"): "Maintain a
 * renderer-neutral scene description. The model produces: plan
 * primitives; annotation primitives; 3D mesh instances; visibility
 * state; selection state; style tokens. Renderers consume these
 * structures." This module is the plan/annotation-primitive half of
 * that (3D mesh instances are geometry-3d/model-renderer's concern, not
 * this package's).
 *
 * A PlanPrimitive is deliberately just shape + a StyleToken - no
 * colour, stroke width, or renderer-specific state. Resolving a
 * StyleToken into actual paint (colour/width/dash pattern) is a
 * renderer backend's job (Canvas 2D per ADR-0008, or a future PixiJS
 * backend) reading the design-system tokens (section 17/18), not this
 * package's - this is exactly the "project semantics remain
 * renderer-independent" boundary every non-goal in this backlog's
 * renderer issues repeats. StyleToken's own members mirror section 18
 * ("State language") directly: hover, active-tool, the two selection
 * tiers, locked, warning, blocking error, hidden, imported, and a
 * proposed-AI-change marker.
 *
 * Deliberately generic over the source element's id type (TId) rather
 * than importing WallId/RoomId/etc. from @arq/bim-core - the same
 * domain-agnostic layering every editor-shell tool in this backlog
 * already establishes (wall-draw-tool.ts, door-placement-tool.ts, ...).
 * A caller one level up (a future "build a PlanScene from this
 * project's elements" step) is the one that knows about Wall/Room/etc.;
 * this module only knows shapes, ids, and style.
 *
 * "Hidden" here means "omitted from the scene entirely" (section 18's
 * "eye-off icon and reduced-opacity row" describes how a hidden
 * element looks in the model panel tree - a separate UI, out of this
 * package's scope - not how it looks on the canvas, where hiding means
 * not drawing it at all). buildPlanScene enforces this by dropping any
 * input whose id is in the hidden set, rather than emitting a
 * "hidden"-styled primitive a renderer might accidentally still draw.
 */

import type { WorldPoint } from '@arq/geometry-2d';

/**
 * Mirrors blueprint section 18's state language. 'selected-primary' is
 * the most-recently-focused member of the current selection (solid
 * outline); 'selected-secondary' is every other selected element
 * (dashed outline) - section 25's point-selection/area-selection both
 * produce exactly this one-primary/many-secondary shape.
 */
export type StyleToken =
  | 'default'
  | 'hover'
  | 'active-tool'
  | 'selected-primary'
  | 'selected-secondary'
  | 'locked'
  | 'warning'
  | 'error'
  | 'imported'
  | 'proposed';

export interface PlanLinePrimitive<TId> {
  readonly kind: 'line';
  readonly elementId: TId;
  readonly points: readonly WorldPoint[];
  readonly styleToken: StyleToken;
}

/** Single-ring only, same scope limit as polygon-area.ts (ARQ-085) and room-boundary-graph.ts (ARQ-111). */
export interface PlanPolygonPrimitive<TId> {
  readonly kind: 'polygon';
  readonly elementId: TId;
  readonly points: readonly WorldPoint[];
  readonly styleToken: StyleToken;
}

/** The annotation-primitive half of section 60 (dimension/note/room-label text). */
export interface PlanTextPrimitive<TId> {
  readonly kind: 'text';
  readonly elementId: TId;
  readonly anchor: WorldPoint;
  readonly text: string;
  readonly styleToken: StyleToken;
}

export type PlanPrimitive<TId> =
  | PlanLinePrimitive<TId>
  | PlanPolygonPrimitive<TId>
  | PlanTextPrimitive<TId>;

export interface PlanScene<TId> {
  readonly primitives: readonly PlanPrimitive<TId>[];
}

/** An un-styled primitive: shape and source element id only, before visibility/selection are resolved into a StyleToken. */
export type PlanPrimitiveInput<TId> =
  | Omit<PlanLinePrimitive<TId>, 'styleToken'>
  | Omit<PlanPolygonPrimitive<TId>, 'styleToken'>
  | Omit<PlanTextPrimitive<TId>, 'styleToken'>;

/** Section 25's selection shape: at most one primary (the most-recently-focused element), plus any number of secondary members. */
export interface PlanSelectionState<TId> {
  readonly primary: TId | null;
  readonly secondary: ReadonlySet<TId>;
}

/**
 * Resolves a single element's StyleToken from visibility/selection/lock
 * state - null means "omit from the scene" (currently only when
 * hidden). Precedence, most to least specific: hidden (omitted) >
 * selected-primary > selected-secondary > locked > default. Hover/
 * active-tool/warning/error/imported/proposed are not derived here -
 * they come from live pointer state or validation results a caller
 * supplies directly on the primitive it builds, not from this
 * project-wide visibility/selection resolution step.
 */
export function resolveStyleToken<TId>(
  elementId: TId,
  hidden: ReadonlySet<TId>,
  selection: PlanSelectionState<TId>,
  locked: ReadonlySet<TId>,
): StyleToken | null {
  if (hidden.has(elementId)) {
    return null;
  }
  if (selection.primary !== null && selection.primary === elementId) {
    return 'selected-primary';
  }
  if (selection.secondary.has(elementId)) {
    return 'selected-secondary';
  }
  if (locked.has(elementId)) {
    return 'locked';
  }
  return 'default';
}

/**
 * Builds the renderer-neutral PlanScene: resolves each input's
 * StyleToken via resolveStyleToken and drops any that resolve to null
 * (hidden). Input order is preserved for the primitives that remain.
 */
export function buildPlanScene<TId>(
  inputs: readonly PlanPrimitiveInput<TId>[],
  hidden: ReadonlySet<TId>,
  selection: PlanSelectionState<TId>,
  locked: ReadonlySet<TId>,
): PlanScene<TId> {
  const primitives: PlanPrimitive<TId>[] = [];
  for (const input of inputs) {
    const styleToken = resolveStyleToken(input.elementId, hidden, selection, locked);
    if (styleToken === null) {
      continue;
    }
    primitives.push({ ...input, styleToken } as PlanPrimitive<TId>);
  }
  return { primitives };
}
