/**
 * ARQ-063: define element base schema.
 *
 * docs/product/ARQ-COMPLETE-PRODUCT-ENGINEERING-BLUEPRINT-v1.0.md lists
 * Element and ElementType as their own core entities (section 32),
 * distinct from any specific category (Wall, Opening, Room, ...). Its
 * own "Base schema examples" (section 37) show Wall/Opening/Room/
 * WallType concretely, though, and those examples do NOT share a common
 * shape beyond an id: Wall has typeId + levelId + geometry, Room has
 * levelId + a calculated boundary but no typeId, Opening has hostWallId
 * (no levelId of its own - it derives level from its host wall) and no
 * typeId (its "kind" is an inline discriminant, not a type reference).
 *
 * So the honestly-justified base schema is deliberately minimal - just
 * an id, and an optional type reference for the (majority, but not all)
 * of element categories that have one. Inventing a richer shared base
 * (e.g. requiring every element to carry levelId) would misrepresent
 * Opening, which the blueprint's own examples show does not have one.
 * Category-specific fields belong on each category's own schema issue
 * (e.g. a future "define wall schema"), not here.
 */

import type { ElementId } from './ids';

export interface ElementBase {
  readonly id: ElementId;
}

/** For element categories that reference a shared type definition (e.g. Wall -> WallType). Not every category has one - see Opening/Room above. */
export interface TypedElementBase<TTypeId> extends ElementBase {
  readonly typeId: TTypeId;
}

export interface ElementTypeBase<TTypeId> {
  readonly id: TTypeId;
  readonly name: string;
}

export function isElementOfCategory<T extends ElementBase>(
  element: ElementBase,
  candidates: readonly T[],
): element is T {
  return candidates.some((candidate) => candidate.id === element.id);
}
