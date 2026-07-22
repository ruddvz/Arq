/**
 * ARQ-128: implement 2D and 3D shared selection.
 *
 * Section 25's "Selection bugs to prevent" names exactly the failure
 * this issue exists to rule out by construction: "2D and 3D
 * highlighting different IDs." Two independent implementations of "is
 * this element primary/secondary/hidden" - one in the 2D plan renderer,
 * one in the 3D model renderer - could drift apart the moment either
 * is edited, silently reintroducing that bug. So this module does not
 * write a second classification function: it imports
 * resolveStyleToken/PlanSelectionState straight from @arq/plan-renderer
 * (ARQ-119) and applies its *exact* output to the 3D scene - the same
 * function, the same inputs, the same answer, for both renderers. This
 * is the one place @arq/model-renderer depends on @arq/plan-renderer;
 * the dependency is one-directional and only for this shared,
 * genuinely renderer-neutral classification, not for anything Canvas
 * 2D/backend-specific.
 *
 * Deliberately narrow about what it does to the 3D scene: hidden means
 * `object.visible = false` (unambiguous, and directly prevents
 * section 25's separate "hidden objects receiving pointer hits" bug,
 * since an invisible Three.js object is also excluded from raycasting
 * in the usual selection-picking setup). Everything else - what colour
 * a 'selected-primary' vs. 'selected-secondary' vs. 'locked' object
 * should actually be painted - is tagged onto `object.userData.styleToken`
 * rather than applied as a material change here: mutating a
 * THREE.Material in place can affect every other mesh sharing that
 * material instance, and choosing an actual highlight technique
 * (emissive tint, outline post-process, a duplicated scaled-up mesh)
 * is real visual design/engineering work this module cannot verify
 * without a real rendered screenshot - the same "tag the data, let a
 * backend paint it" principle plan-scene.ts's PlanPrimitive.styleToken
 * already establishes for the 2D side.
 *
 * A wall may correspond to *multiple* THREE.Object3D instances after
 * opening-panel decomposition (wall-opening-meshes.ts, ARQ-125, splits
 * one wall into several pier/sill/header pieces) - applySharedSelection
 * accepts one-or-more objects per element id for exactly this reason.
 */

import type { Object3D } from 'three';
import { resolveStyleToken, type PlanSelectionState, type StyleToken } from '@arq/plan-renderer';

export type { PlanSelectionState, StyleToken };

/**
 * Applies the shared 2D/3D selection classification to every entry in
 * `objectsByElementId`: sets `.visible` (false when hidden, true
 * otherwise) and tags `.userData.styleToken` with the resolved
 * StyleToken (omitted/left untouched when hidden, since a hidden
 * object's style is meaningless) - using the exact same
 * resolveStyleToken function (ARQ-119) the 2D plan renderer already
 * calls, so both views can never classify the same element
 * differently.
 */
export function applySharedSelection<TId>(
  objectsByElementId: ReadonlyMap<TId, Object3D | readonly Object3D[]>,
  hidden: ReadonlySet<TId>,
  selection: PlanSelectionState<TId>,
  locked: ReadonlySet<TId>,
): void {
  for (const [elementId, objectOrObjects] of objectsByElementId) {
    const styleToken = resolveStyleToken(elementId, hidden, selection, locked);
    const objects = Array.isArray(objectOrObjects) ? objectOrObjects : [objectOrObjects];
    for (const object of objects) {
      if (styleToken === null) {
        object.visible = false;
        continue;
      }
      object.visible = true;
      object.userData.styleToken = styleToken;
    }
  }
}
