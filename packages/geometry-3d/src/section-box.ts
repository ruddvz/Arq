import type { Extent3, Point3 } from './origin-rebase';

/**
 * V3-127: a section box clips a view. It never changes the building.
 *
 * A section box is how someone looks inside a model: shrink a box around the
 * part they care about and everything outside it stops being drawn. The whole
 * risk in implementing one is that it looks exactly like a destructive
 * operation from the outside - geometry disappears - and the difference is
 * invisible until someone saves, exports or schedules.
 *
 * So this module computes classifications and produces no geometry, holds no
 * model state and offers nothing that removes anything. A caller can use it to
 * decide what to draw. There is no function here that could be mistaken for one
 * that deletes, and `sectionBoxAffectsQuantities` exists to state in code that
 * a clipped model is not a smaller model.
 *
 * An element straddling the box face is the interesting case. Hiding it is
 * wrong - the reason to cut a section is to see inside the wall on the boundary
 * - and drawing it whole defeats the box. It is reported as `straddling` so the
 * renderer clips it and the caller knows a cut face has to be drawn there,
 * which is what makes a section read as a section rather than as a hole.
 */

export interface SectionBox {
  readonly min: Point3;
  readonly max: Point3;
  /** A disabled box is kept rather than deleted, so re-enabling restores the same view. */
  readonly enabled: boolean;
}

export type SectionClassification = 'inside' | 'outside' | 'straddling';

/**
 * Where an element's extent sits relative to the box.
 *
 * A disabled box classifies everything as inside rather than as straddling: a
 * turned-off section box is not a section, and reporting a cut face for one
 * would draw cut hatching across an unsectioned model.
 */
export function classifyAgainstSectionBox(extent: Extent3, box: SectionBox): SectionClassification {
  if (!box.enabled) {
    return 'inside';
  }

  const separated =
    extent.max.x < box.min.x ||
    extent.min.x > box.max.x ||
    extent.max.y < box.min.y ||
    extent.min.y > box.max.y ||
    extent.max.z < box.min.z ||
    extent.min.z > box.max.z;
  if (separated) {
    return 'outside';
  }

  const contained =
    extent.min.x >= box.min.x &&
    extent.max.x <= box.max.x &&
    extent.min.y >= box.min.y &&
    extent.max.y <= box.max.y &&
    extent.min.z >= box.min.z &&
    extent.max.z <= box.max.z;

  return contained ? 'inside' : 'straddling';
}

/** Whether the element contributes anything to draw at all. */
export function isDrawnUnderSectionBox(extent: Extent3, box: SectionBox): boolean {
  return classifyAgainstSectionBox(extent, box) !== 'outside';
}

/**
 * Whether a section box changes a schedule or take-off.
 *
 * Always false, and written as a function for the same reason
 * `visibleForSchedule` is: a clipped model is not a smaller model, and a
 * quantity that agreed with the clipped view would under-order every time
 * someone left a section box on.
 */
export function sectionBoxAffectsQuantities(): false {
  return false;
}

export const SECTION_BOX_FACES = ['minX', 'maxX', 'minY', 'maxY', 'minZ', 'maxZ'] as const;
export type SectionBoxFace = (typeof SECTION_BOX_FACES)[number];

/**
 * Which faces of the box an extent crosses.
 *
 * A renderer needs this to know which cut planes produce a face on this
 * element. An element crossing two faces at a corner needs both, and a caller
 * that only handled the first would leave one side of the corner open.
 */
export function crossedFaces(extent: Extent3, box: SectionBox): readonly SectionBoxFace[] {
  if (!box.enabled || classifyAgainstSectionBox(extent, box) !== 'straddling') {
    return [];
  }
  const faces: SectionBoxFace[] = [];
  if (extent.min.x < box.min.x) faces.push('minX');
  if (extent.max.x > box.max.x) faces.push('maxX');
  if (extent.min.y < box.min.y) faces.push('minY');
  if (extent.max.y > box.max.y) faces.push('maxY');
  if (extent.min.z < box.min.z) faces.push('minZ');
  if (extent.max.z > box.max.z) faces.push('maxZ');
  return faces;
}

/**
 * Moves one face of the box.
 *
 * Refuses to push a face past its opposite rather than silently swapping them.
 * An inverted box has no inside, so every element classifies as outside and the
 * model vanishes - which reads to the user as a crash, from a drag they can
 * neither see nor undo the meaning of. Clamping to a zero-thickness box would
 * be equally blank; returning null lets the caller stop the drag at the limit,
 * which is what every other bounded drag does.
 */
export function moveSectionBoxFace(
  box: SectionBox,
  face: SectionBoxFace,
  value: number,
): SectionBox | null {
  if (!Number.isFinite(value)) {
    return null;
  }

  const min = { ...box.min };
  const max = { ...box.max };

  switch (face) {
    case 'minX':
      if (value >= max.x) return null;
      min.x = value;
      break;
    case 'maxX':
      if (value <= min.x) return null;
      max.x = value;
      break;
    case 'minY':
      if (value >= max.y) return null;
      min.y = value;
      break;
    case 'maxY':
      if (value <= min.y) return null;
      max.y = value;
      break;
    case 'minZ':
      if (value >= max.z) return null;
      min.z = value;
      break;
    case 'maxZ':
      if (value <= min.z) return null;
      max.z = value;
      break;
  }

  return { min, max, enabled: box.enabled };
}

/** A box around the whole model, which is what "reset" restores. */
export function sectionBoxFromExtent(extent: Extent3, enabled = false): SectionBox {
  return { min: { ...extent.min }, max: { ...extent.max }, enabled };
}

/**
 * A sentence explaining why part of the model is not drawn.
 *
 * The same reasoning as `describeVisibility`: geometry disappearing is alarming,
 * and a user who cannot find the rule that did it starts to distrust the tool.
 * A section box is especially easy to leave on and forget.
 */
export function describeSectionBoxEffect(box: SectionBox, outsideCount: number): string | null {
  if (!box.enabled || outsideCount === 0) {
    return null;
  }
  const noun = outsideCount === 1 ? 'element is' : 'elements are';
  return `The section box is on. ${outsideCount} ${noun} outside it and not drawn. Nothing has been removed from the project.`;
}
