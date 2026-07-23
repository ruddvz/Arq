/**
 * ARQ-140: define sheet schema.
 *
 * Blueprint section 58 ("Sheets") lists a "First sheet"'s properties
 * verbatim: "standard size; custom size; title; number; project
 * metadata; one plan viewport; scale; revision; export." This module
 * covers everything on that list except "export" (a capability -
 * section 59's PDF export pipeline - not stored sheet data) and
 * "project metadata" (satisfied by referencing the project's own id
 * rather than duplicating its name/units here - the same
 * reference-not-copy choice `Wall.typeId` already makes for WallType).
 *
 * "One plan viewport" (v1) vs. "Later: multiple viewports" means
 * `Sheet.viewport` is a single `SheetViewport`, not an array - adding
 * multiple viewports is exactly the "later release scope" this issue's
 * own non-goals exclude.
 *
 * `SheetViewport.position` is deliberately a locally-declared
 * `SheetPoint`, not `@arq/geometry-2d`'s `WorldPoint`: that module's own
 * doc comment defines `WorldPoint` as "project/model units" specifically
 * to prevent conflating distinct coordinate spaces (its whole reason for
 * existing, per coordinate-system.ts, ARQ-032) - a viewport's position
 * on a printed page is a third space (paper space), not model space or
 * screen space, so reusing `WorldPoint` here would be exactly the kind
 * of space-conflation bug that module exists to prevent.
 *
 * `SheetSize`'s 'standard' variant takes a caller-supplied `name`
 * (e.g. "A1", "ARCH D") rather than a hardcoded enum: section 58 never
 * lists which standard sizes Arq supports, and inventing a specific set
 * here would misrepresent an undecided catalogue as decided - the same
 * reasoning text-note.ts (ARQ-139) already applied to `styleId`.
 *
 * `ViewId` is referenced, not defined: View is its own core entity
 * (section 32) with no schema in this repository yet - modelling it is
 * a separate, later issue, so `SheetViewport.viewId` is an opaque
 * reference a Sheet can point at, the same "reference what doesn't
 * exist yet as an opaque id" choice dimension-reference.ts (ARQ-136)
 * made for Grid.
 */

import type { Length } from './length';
import type { ProjectId, SheetId, ViewId } from './ids';

export interface SheetPoint {
  readonly x: number;
  readonly y: number;
}

export type SheetSize =
  | { readonly kind: 'standard'; readonly name: string }
  | { readonly kind: 'custom'; readonly width: Length; readonly height: Length };

export interface SheetViewport {
  readonly viewId: ViewId;
  /** Paper units per model unit (e.g. 1/100 expressed as 0.01) - must be positive and finite. */
  readonly scale: number;
  readonly position: SheetPoint;
}

export interface Sheet {
  readonly id: SheetId;
  readonly projectId: ProjectId;
  readonly number: string;
  readonly title: string;
  readonly size: SheetSize;
  readonly viewport: SheetViewport;
  readonly revision: number;
}

export interface CreateSheetInput {
  readonly id: SheetId;
  readonly projectId: ProjectId;
  readonly number: string;
  readonly title: string;
  readonly size: SheetSize;
  readonly viewport: SheetViewport;
}

/**
 * Constructs a Sheet at revision 0. Rejects a non-positive/non-finite
 * viewport scale, a non-positive/non-finite custom width or height, and
 * an empty standard size name - the one structural sanity check this
 * schema-definition issue can make without a real title-block renderer.
 */
export function createSheet(input: CreateSheetInput): Sheet {
  if (!Number.isFinite(input.viewport.scale) || input.viewport.scale <= 0) {
    throw new RangeError('viewport.scale must be a positive finite number');
  }
  if (input.size.kind === 'standard' && input.size.name.trim().length === 0) {
    throw new RangeError('a standard SheetSize must have a non-empty name');
  }
  if (input.size.kind === 'custom') {
    const { width, height } = input.size;
    if (!Number.isFinite(width.value) || width.value <= 0) {
      throw new RangeError('a custom SheetSize width must be a positive finite length');
    }
    if (!Number.isFinite(height.value) || height.value <= 0) {
      throw new RangeError('a custom SheetSize height must be a positive finite length');
    }
  }
  return {
    id: input.id,
    projectId: input.projectId,
    number: input.number,
    title: input.title,
    size: input.size,
    viewport: input.viewport,
    revision: 0,
  };
}
