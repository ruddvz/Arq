/**
 * ARQ-102: implement offset wall.
 *
 * The domain half of the blueprint's "Offset" tool (item 16 of the
 * first-40 toolbar list) applied to a Wall: produces an independent
 * parallel copy of an existing wall, moved sideways by a signed
 * perpendicular distance, rather than modifying the original in place -
 * matching how a CAD offset tool works on any other drawn entity (the
 * source stays untouched, a new entity is created alongside it).
 *
 * Reuses offsetSegment (geometry-2d, ARQ-102) for the actual math and
 * its sign convention (positive distance = left of the wall's own
 * start-to-end direction); returns null for the same degenerate cases
 * offsetSegment refuses (zero-length wall, invalid tolerance/distance)
 * rather than fabricating a copy.
 *
 * The new wall gets a caller-supplied id and 'auto' at both ends: it
 * has no join relationship with anything yet (the whole point of an
 * offset copy is that it starts life disconnected from its source), so
 * inheriting the original wall's joinStart/joinEnd would misrepresent a
 * join intent that doesn't exist at the new location.
 *
 * Known, documented gap, same as splitWall (wall-split.ts, ARQ-101):
 * hostedOpeningIds is cleared rather than carried over. An opening's
 * position is defined relative to its host wall's own face/centerline;
 * copying the id list across to a wall at a different location would
 * silently point at openings that no longer sit anywhere on the new
 * wall's span. Opening is not modelled in this repository yet (see the
 * same gap noted in wall-split.ts and wall-instance.ts) - a caller must
 * decide what to do about openings once it exists.
 *
 * Purely functional: nothing here touches committed project state;
 * applying the result is the caller's job via CreateElement
 * (create-element-operation.ts, ARQ-067/069). Escape/Enter have no
 * meaning at this pure-function layer, the same as wall-trim-extend.ts
 * and wall-split.ts.
 */

import { offsetSegment } from '@arq/geometry-2d';
import type { WallId } from './ids';
import type { Wall } from './wall-instance';

export function offsetWall(
  wall: Wall,
  distance: number,
  newId: WallId,
  tolerance: number,
): Wall | null {
  const offsetLine = offsetSegment({ start: wall.start, end: wall.end }, distance, tolerance);
  if (!offsetLine) {
    return null;
  }

  return {
    ...wall,
    id: newId,
    start: offsetLine.start,
    end: offsetLine.end,
    joinStart: 'auto',
    joinEnd: 'auto',
    hostedOpeningIds: [],
  };
}
