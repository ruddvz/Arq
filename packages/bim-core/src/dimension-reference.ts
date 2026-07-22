/**
 * ARQ-136: define dimension reference model.
 *
 * docs/product/ARQ-COMPLETE-PRODUCT-ENGINEERING-BLUEPRINT-v1.0.md section
 * 55 ("Dimensions") lists a linear dimension's References verbatim:
 * "wall reference line; wall face; opening centre; opening edge;
 * explicit point; grid later." This module is exactly that list as a
 * discriminated union - the schema half of "Dimensions", not the
 * dimension entity itself (witness lines, offset, text position, style,
 * precision, prefix/suffix - all "Properties" in the same section) or
 * its resolution to an actual measured value, both of which are
 * ARQ-137 ("implement linear dimension")'s job, kept separate the same
 * way opening.ts's schema and door-placement-tool.ts's interactive tool
 * are separate issues.
 *
 * "grid later" is the one reference kind deliberately not modelled:
 * Grid is listed among section 32's core entities but has no schema of
 * its own anywhere in this repository yet, so a 'grid-line' reference
 * kind would have nothing real to point at - inventing one now is
 * exactly this issue's own "do not expand into later release scope"
 * non-goal.
 *
 * dimensionReferenceElementId/dimensionReferenceIsDetached exist because
 * section 55's own Rules require it: "detached references show
 * warning". A reference is only ever detached from an *element*
 * (a wall or opening no longer existing) - an explicit-point reference
 * names no element at all, so it can never be detached, matching how
 * the blueprint lists "explicit point" as its own reference kind
 * distinct from the element-anchored ones rather than a degenerate case
 * of them.
 */

import type { WorldPoint } from '@arq/geometry-2d';
import type { ElementId, OpeningId, WallId } from './ids';

export type WallFaceSide = 'interior' | 'exterior';
export type OpeningEdgeSide = 'start' | 'end';

export type DimensionReference =
  | { readonly kind: 'wall-reference-line'; readonly wallId: WallId }
  | { readonly kind: 'wall-face'; readonly wallId: WallId; readonly side: WallFaceSide }
  | { readonly kind: 'opening-centre'; readonly openingId: OpeningId }
  | { readonly kind: 'opening-edge'; readonly openingId: OpeningId; readonly edge: OpeningEdgeSide }
  | { readonly kind: 'explicit-point'; readonly point: WorldPoint };

export function wallReferenceLine(wallId: WallId): DimensionReference {
  return { kind: 'wall-reference-line', wallId };
}

export function wallFace(wallId: WallId, side: WallFaceSide): DimensionReference {
  return { kind: 'wall-face', wallId, side };
}

export function openingCentre(openingId: OpeningId): DimensionReference {
  return { kind: 'opening-centre', openingId };
}

export function openingEdge(openingId: OpeningId, edge: OpeningEdgeSide): DimensionReference {
  return { kind: 'opening-edge', openingId, edge };
}

export function explicitPoint(point: WorldPoint): DimensionReference {
  return { kind: 'explicit-point', point };
}

/** The element `reference` is anchored to, or null for explicit-point (which names no element). */
export function dimensionReferenceElementId(reference: DimensionReference): ElementId | null {
  switch (reference.kind) {
    case 'wall-reference-line':
    case 'wall-face':
      return reference.wallId;
    case 'opening-centre':
    case 'opening-edge':
      return reference.openingId;
    case 'explicit-point':
      return null;
  }
}

/** Section 55's "detached references show warning": true when `reference` names an element that is not in `existingElementIds`. An explicit-point reference is never detached. */
export function dimensionReferenceIsDetached(
  reference: DimensionReference,
  existingElementIds: ReadonlySet<ElementId>,
): boolean {
  const elementId = dimensionReferenceElementId(reference);
  return elementId !== null && !existingElementIds.has(elementId);
}
