/**
 * ARQ-125: generate opening meshes.
 *
 * Blueprint section 39 lists "opening subtraction for supported
 * primitives" among geometry-3d's responsibilities. A full boolean
 * (CSG) subtraction is exactly the general-purpose-CAD-kernel weight
 * ADR-0007/blueprint section 38 says the first wall/room system does
 * not need. "Supported primitives" here means the one case Release 1
 * actually requires: a rectangular opening that always cuts all the
 * way through a straight wall's thickness (a door/window never stops
 * partway through a wall) - which turns "subtract a hole from a solid"
 * into a much simpler problem: decompose the wall into non-overlapping
 * rectangular *panels* (piers beside each opening, a sill panel below
 * it if its sillHeight is above the wall base, a header panel above it
 * if its top is below the wall height) that together exactly fill the
 * wall minus its openings - then extrude each panel with
 * extrudePolygonMesh (ARQ-124), unchanged. No new triangulation or
 * boolean algorithm is needed; a wall with zero openings degenerates to
 * exactly one panel (the whole wall), matching ARQ-124's own mesh.
 *
 * Reuses wall-face-line.ts's faceLineCorners (geometry-2d, ARQ-093)
 * directly for each panel's footprint: passing a *sub-segment* of the
 * wall's own centerline (from one length-offset to another) to the
 * exact same function that already builds a wall's full-length face
 * corners, since faceLineCorners bounds its result to whatever
 * centerline segment it is given - no new 2D geometry primitive was
 * needed to make this work.
 *
 * Deliberately generic over plain numbers (offsetFromWallStart, width,
 * sillHeight, height), not bim-core's Opening - the same
 * domain-agnostic layering every other package boundary in this
 * backlog keeps; a caller maps a real Opening's typed Length fields to
 * these plain numbers (the same provisional world-units-as-mm stance
 * opening.ts, bim-core, already takes for a different comparison).
 *
 * Known, documented limitation: overlapping openings are not this
 * module's concern to detect or repair - that validation already
 * exists (opening-overlap-validation.ts, ARQ-109) and is assumed to
 * have already passed before this module is called; this module does
 * not crash on overlapping input, but its output is only meaningful
 * for a non-overlapping opening set.
 */

import {
  faceLineCorners,
  normalizeVector,
  scaleVector,
  translatePoint,
  vectorBetween,
  vectorLength,
  type Segment,
  type WallAlignment,
} from '@arq/geometry-2d';
import { extrudePolygonMesh, type Mesh3D } from './extrude-polygon-mesh';

export interface WallOpeningSpan {
  readonly offsetFromWallStart: number;
  readonly width: number;
  readonly sillHeight: number;
  readonly height: number;
}

interface WallPanel {
  readonly lengthStart: number;
  readonly lengthEnd: number;
  readonly elevationStart: number;
  readonly elevationEnd: number;
}

/** Decomposes a wall's [0, wallLength] x [0, wallHeight] rectangle into piers/sills/headers around each opening - pure interval arithmetic, no geometry yet. */
function wallOpeningPanels(
  wallLength: number,
  wallHeight: number,
  openings: readonly WallOpeningSpan[],
): readonly WallPanel[] {
  const sorted = [...openings].sort((a, b) => a.offsetFromWallStart - b.offsetFromWallStart);
  const panels: WallPanel[] = [];
  let cursor = 0;

  for (const opening of sorted) {
    const openingStart = opening.offsetFromWallStart;
    const openingEnd = openingStart + opening.width;
    if (openingStart > cursor) {
      panels.push({
        lengthStart: cursor,
        lengthEnd: openingStart,
        elevationStart: 0,
        elevationEnd: wallHeight,
      });
    }
    if (opening.sillHeight > 0) {
      panels.push({
        lengthStart: openingStart,
        lengthEnd: openingEnd,
        elevationStart: 0,
        elevationEnd: opening.sillHeight,
      });
    }
    const openingTop = opening.sillHeight + opening.height;
    if (openingTop < wallHeight) {
      panels.push({
        lengthStart: openingStart,
        lengthEnd: openingEnd,
        elevationStart: openingTop,
        elevationEnd: wallHeight,
      });
    }
    cursor = Math.max(cursor, openingEnd);
  }
  if (cursor < wallLength) {
    panels.push({
      lengthStart: cursor,
      lengthEnd: wallLength,
      elevationStart: 0,
      elevationEnd: wallHeight,
    });
  }
  return panels;
}

/**
 * Generates one Mesh3D per wall panel (piers/sills/headers around each
 * opening) - the wall's mesh "with holes" for its openings, per this
 * module's doc comment. Returns null for the same degenerate input
 * wall-face-line.ts/extrude-polygon-mesh.ts already refuse: a
 * zero-length centerline, non-finite/non-positive wallHeight, or a
 * panel whose face-line construction itself fails.
 */
export function generateWallOpeningMeshes(
  centerline: Segment,
  thickness: number,
  alignment: WallAlignment,
  wallHeight: number,
  baseElevation: number,
  openings: readonly WallOpeningSpan[],
  tolerance: number,
): readonly Mesh3D[] | null {
  const wallLength = vectorLength(vectorBetween(centerline.start, centerline.end));
  if (!Number.isFinite(wallLength) || wallLength <= tolerance) {
    return null;
  }
  if (!Number.isFinite(wallHeight) || wallHeight <= 0) {
    return null;
  }
  const direction = normalizeVector(vectorBetween(centerline.start, centerline.end));
  if (!direction) {
    return null;
  }

  const panels = wallOpeningPanels(wallLength, wallHeight, openings);
  const meshes: Mesh3D[] = [];

  for (const panel of panels) {
    if (panel.lengthEnd - panel.lengthStart <= tolerance) {
      continue;
    }
    const panelStart = translatePoint(centerline.start, scaleVector(direction, panel.lengthStart));
    const panelEnd = translatePoint(centerline.start, scaleVector(direction, panel.lengthEnd));
    const outline = faceLineCorners(
      { start: panelStart, end: panelEnd },
      thickness,
      alignment,
      tolerance,
    );
    if (!outline) {
      return null;
    }
    const mesh = extrudePolygonMesh(
      outline,
      baseElevation + panel.elevationStart,
      panel.elevationEnd - panel.elevationStart,
    );
    if (!mesh) {
      return null;
    }
    meshes.push(mesh);
  }

  return meshes;
}
