/**
 * ARQ-113 (editor half): implement zoom to room gap.
 *
 * The "'Zoom to gap' action" from blueprint section 49's Room error UX:
 * given a gap found by findNearestRoomBoundaryGap (@arq/geometry-2d,
 * ARQ-113's geometry half), frame both of its points on screen with
 * generous surrounding context, so the user can see exactly where and
 * how large the break in the wall network is.
 *
 * This is a thin wrapper around viewport-controller.ts's existing
 * fitToBounds (ARQ-033): a gap's two points already are a bounding box,
 * so no new framing math is needed. The only real decision here is the
 * default margin - larger than fitToBounds's own default (40px),
 * because a gap's bounding box is frequently near-zero-size (a wall end
 * missing another by a few centimetres) and needs generous padding
 * around it to keep nearby walls in view for context, not just the two
 * bare points.
 */

import { worldPoint, type RoomBoundaryGap, type Viewport } from '@arq/geometry-2d';
import { fitToBounds } from './viewport-controller';

const DEFAULT_GAP_ZOOM_MARGIN_PX = 120;

/** Frames a room-boundary gap's two points on screen, per blueprint section 49's "Zoom to gap" action. */
export function zoomToRoomGap(
  gap: RoomBoundaryGap,
  screenWidth: number,
  screenHeight: number,
  marginPx: number = DEFAULT_GAP_ZOOM_MARGIN_PX,
): Viewport {
  const minX = Math.min(gap.from.x, gap.to.x);
  const maxX = Math.max(gap.from.x, gap.to.x);
  const minY = Math.min(gap.from.y, gap.to.y);
  const maxY = Math.max(gap.from.y, gap.to.y);
  return fitToBounds(
    { min: worldPoint(minX, minY), max: worldPoint(maxX, maxY) },
    screenWidth,
    screenHeight,
    marginPx,
  );
}
