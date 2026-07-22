import { describe, expect, it } from 'vitest';
import { worldPoint, type RoomBoundaryGap } from '@arq/geometry-2d';
import { zoomToRoomGap } from './zoom-to-room-gap';

describe('zoomToRoomGap', () => {
  it('centres the viewport on the midpoint of the gap', () => {
    const gap: RoomBoundaryGap = { from: worldPoint(0, 0), to: worldPoint(10, 0), distance: 10 };
    const viewport = zoomToRoomGap(gap, 800, 600);
    expect(viewport.center.x).toBeCloseTo(5, 6);
    expect(viewport.center.y).toBeCloseTo(0, 6);
  });

  it('zooms in enough that both gap points are comfortably visible', () => {
    const gap: RoomBoundaryGap = { from: worldPoint(0, 0), to: worldPoint(10, 0), distance: 10 };
    const viewport = zoomToRoomGap(gap, 800, 600, 100);
    // With a 100px margin on each side, the available width for the 10-unit
    // gap is 600px, so pixelsPerUnit should be at least 60.
    expect(viewport.pixelsPerUnit).toBeGreaterThanOrEqual(60);
  });

  it('handles a near-zero-size gap (both points almost coincident) without a degenerate viewport', () => {
    const gap: RoomBoundaryGap = {
      from: worldPoint(5, 5),
      to: worldPoint(5.0000001, 5),
      distance: 0.0000001,
    };
    const viewport = zoomToRoomGap(gap, 800, 600);
    expect(Number.isFinite(viewport.pixelsPerUnit)).toBe(true);
    expect(viewport.pixelsPerUnit).toBeGreaterThan(0);
  });

  it('respects a custom margin', () => {
    const gap: RoomBoundaryGap = { from: worldPoint(0, 0), to: worldPoint(10, 0), distance: 10 };
    const withSmallMargin = zoomToRoomGap(gap, 800, 600, 10);
    const withLargeMargin = zoomToRoomGap(gap, 800, 600, 300);
    expect(withSmallMargin.pixelsPerUnit).toBeGreaterThan(withLargeMargin.pixelsPerUnit);
  });

  it('sets the viewport screen dimensions to the given screenWidth/screenHeight', () => {
    const gap: RoomBoundaryGap = { from: worldPoint(0, 0), to: worldPoint(10, 0), distance: 10 };
    const viewport = zoomToRoomGap(gap, 1024, 768);
    expect(viewport.screenWidth).toBe(1024);
    expect(viewport.screenHeight).toBe(768);
  });
});
