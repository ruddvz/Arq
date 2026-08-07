/**
 * Hatching a room, as line segments rather than as a fill.
 *
 * A drawn plan hatches what is not floor - the open courtyard on the golden
 * fixture is outdoors, and a flat tint says "another room in a slightly
 * different colour" where a hatch says "you are outside".
 *
 * It is computed rather than painted with a pattern because the renderer's
 * paint target is deliberately narrow: `Canvas2dPaintTarget` is a `Pick<>` of
 * the 2D context carrying no `save`, `restore`, `clip` or `createPattern`. A
 * pattern fill or a clipped hatch would mean widening that type and every fake
 * that stands in for it in a test, to buy something the geometry already gives
 * for free. Clipping a line to a polygon is the even-odd scanline rule, which
 * is arithmetic, works for any simple polygon, and can be tested without a
 * canvas at all.
 *
 * Single ring only, the same scope limit `polygon-area.ts` and
 * `point-in-polygon.ts` already keep: a room with an island is a multi-ring
 * concept this module does not model.
 */

import { worldPoint, type WorldPoint } from '@arq/geometry-2d';

export interface HatchSegment {
  readonly start: WorldPoint;
  readonly end: WorldPoint;
}

/**
 * Everything shorter than this is dropped, in world units.
 *
 * A hatch line that clips a polygon exactly at a vertex produces a segment of
 * no length. Drawing it costs a path and puts a dot on the drawing at the one
 * place - a corner - where a stray mark is most likely to be read as geometry.
 */
const DEGENERATE_LENGTH = 1e-6;

/**
 * The parts of a set of parallel lines that fall inside a polygon.
 *
 * `angleRadians` is measured from the +x axis; the lines run along it and are
 * spaced `spacing` apart perpendicular to it. Both are world units, so a hatch
 * is a property of the building rather than of the zoom - which is what makes
 * it behave like drawn hatching and not like a screen texture.
 *
 * Returns an empty list rather than throwing for a degenerate request. A room
 * that cannot be hatched is a room drawn without hatching, and refusing to
 * paint the rest of the plan over it would be a poor trade.
 */
export function hatchSegments(
  polygon: readonly WorldPoint[],
  spacing: number,
  angleRadians: number,
): readonly HatchSegment[] {
  if (polygon.length < 3) return [];
  if (!Number.isFinite(spacing) || spacing <= 0) return [];
  if (!Number.isFinite(angleRadians)) return [];

  const along = { x: Math.cos(angleRadians), y: Math.sin(angleRadians) };
  // The hatch direction's normal. Distance along it is what indexes the lines.
  const across = { x: -along.y, y: along.x };

  let minAcross = Number.POSITIVE_INFINITY;
  let maxAcross = Number.NEGATIVE_INFINITY;
  for (const vertex of polygon) {
    const distance = vertex.x * across.x + vertex.y * across.y;
    minAcross = Math.min(minAcross, distance);
    maxAcross = Math.max(maxAcross, distance);
  }
  if (!Number.isFinite(minAcross) || !Number.isFinite(maxAcross)) return [];

  const segments: HatchSegment[] = [];
  /*
   * Lines are placed on multiples of the spacing from the world origin, not
   * from the room's own first line. Two rooms that touch then share the same
   * hatch grid and their hatching lines up across the wall between them, which
   * is what a hand-drawn plan does and what makes hatching read as one material
   * rather than as a per-room decoration.
   */
  const firstIndex = Math.ceil(minAcross / spacing);
  const lastIndex = Math.floor(maxAcross / spacing);

  for (let index = firstIndex; index <= lastIndex; index += 1) {
    const offset = index * spacing;
    const crossings: number[] = [];

    for (let edge = 0; edge < polygon.length; edge += 1) {
      const start = polygon[edge]!;
      const end = polygon[(edge + 1) % polygon.length]!;
      const startAcross = start.x * across.x + start.y * across.y;
      const endAcross = end.x * across.x + end.y * across.y;

      /*
       * The half-open rule: an edge counts when the line falls in
       * [startAcross, endAcross) rather than in the closed interval. It is what
       * makes a line passing exactly through a vertex cross once rather than
       * twice or not at all - the same convention `point-in-polygon.ts` uses
       * for its ray, and the reason a hatch does not leak out of a room whose
       * corner it happens to touch.
       */
      if (startAcross > offset === endAcross > offset) continue;

      const t = (offset - startAcross) / (endAcross - startAcross);
      if (!Number.isFinite(t)) continue;
      const x = start.x + (end.x - start.x) * t;
      const y = start.y + (end.y - start.y) * t;
      crossings.push(x * along.x + y * along.y);
    }

    if (crossings.length < 2) continue;
    crossings.sort((a, b) => a - b);

    // Alternate pairs are inside the ring, which is the even-odd rule. A
    // concave room produces four crossings on a line and two drawn spans.
    for (let pair = 0; pair + 1 < crossings.length; pair += 2) {
      const from = crossings[pair]!;
      const to = crossings[pair + 1]!;
      if (to - from <= DEGENERATE_LENGTH) continue;
      segments.push({
        start: worldPoint(along.x * from + across.x * offset, along.y * from + across.y * offset),
        end: worldPoint(along.x * to + across.x * offset, along.y * to + across.y * offset),
      });
    }
  }

  return segments;
}
