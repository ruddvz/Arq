/**
 * ARQ-121: implement selection rendering.
 *
 * Blueprint section 18's state language: "Primary selection: black
 * outline, light neutral halo, white handles with black border.
 * Secondary selection: dashed outline." A dashed outline and a halo are
 * pure paint decisions a PlanRenderer backend makes from a primitive's
 * existing StyleToken ('selected-primary'/'selected-secondary',
 * plan-scene.ts ARQ-119) - reading the same points twice (once for a
 * wide light-grey halo stroke, once for the normal black stroke on top)
 * needs no new geometry. Handles do: a handle is a genuinely new point
 * (one per vertex) that does not exist anywhere in the base scene, so
 * producing them is real derived-geometry work, not a paint variant -
 * that is this module's actual job.
 *
 * withSelectionHandles is deliberately a separate step from
 * buildPlanScene (plan-scene.ts): it only ever adds PlanHandlePrimitive
 * entries for whichever line/polygon primitives are already tagged
 * 'selected-primary' - section 18 shows handles only on the primary
 * selection (the single most-recently-focused element), not on every
 * secondary-selected member of a multi-select, matching how a handle
 * exists to let the user drag that one element's own vertices.
 *
 * Kept renderer-independent on purpose (no Canvas 2D/PixiJS import):
 * this only produces more PlanPrimitive entries: a backend paints them
 * (section 18's "white handles with black border") however it likes.
 */

import type { WorldPoint } from '@arq/geometry-2d';
import type { PlanHandlePrimitive, PlanPrimitive, PlanScene } from './plan-scene';

/** The vertex points a primitive should grow selection handles at - line/polygon vertices; text/handle primitives have none. */
function handleSourcePoints<TId>(primitive: PlanPrimitive<TId>): readonly WorldPoint[] {
  switch (primitive.kind) {
    case 'line':
    case 'polygon':
      return primitive.points;
    case 'text':
    case 'handle':
      return [];
  }
}

/**
 * Adds one PlanHandlePrimitive per vertex of every 'selected-primary'
 * line/polygon primitive already in `scene` - the scene's other
 * primitives are returned unchanged and in their original order, with
 * handles appended after them.
 */
export function withSelectionHandles<TId>(scene: PlanScene<TId>): PlanScene<TId> {
  const handles: PlanHandlePrimitive<TId>[] = [];
  for (const primitive of scene.primitives) {
    if (primitive.styleToken !== 'selected-primary') {
      continue;
    }
    for (const point of handleSourcePoints(primitive)) {
      handles.push({
        kind: 'handle',
        elementId: primitive.elementId,
        point,
        styleToken: 'selected-primary',
      });
    }
  }
  if (handles.length === 0) {
    return scene;
  }
  return { primitives: [...scene.primitives, ...handles] };
}
