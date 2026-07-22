import { describe, expect, it } from 'vitest';
import { worldPoint } from '@arq/geometry-2d';
import { elementId, levelId, roomId } from './ids';
import { createRoom } from './room';
import { recalculateRoomArea, roomAreaIsTooSmall, roomAreaSquareMetres } from './room-area';

const fourByThreeMetreBoundary = [
  worldPoint(0, 0),
  worldPoint(4000, 0),
  worldPoint(4000, 3000),
  worldPoint(0, 3000),
];

describe('roomAreaSquareMetres', () => {
  it('converts a 4m x 3m boundary (in mm world units) to 12 square metres', () => {
    expect(roomAreaSquareMetres(fourByThreeMetreBoundary)).toBeCloseTo(12, 9);
  });

  it('returns 0 for a degenerate boundary (fewer than 3 points)', () => {
    expect(roomAreaSquareMetres([worldPoint(0, 0), worldPoint(1, 1)])).toBe(0);
  });

  it('is unaffected by winding direction (returns the same magnitude either way)', () => {
    const reversed = [...fourByThreeMetreBoundary].reverse();
    expect(roomAreaSquareMetres(reversed)).toBeCloseTo(
      roomAreaSquareMetres(fourByThreeMetreBoundary),
      9,
    );
  });
});

describe('recalculateRoomArea', () => {
  const room = createRoom({
    id: roomId('r-1'),
    levelId: levelId('l-1'),
    seedPoint: worldPoint(2000, 1500),
    name: 'Living Room',
    boundaryElementIds: [elementId('w-1'), elementId('w-2'), elementId('w-3'), elementId('w-4')],
    calculatedBoundary: fourByThreeMetreBoundary,
    calculatedArea: 0,
    status: 'valid',
  });

  it('updates calculatedArea to match the boundary', () => {
    const updated = recalculateRoomArea(room);
    expect(updated.calculatedArea).toBeCloseTo(12, 9);
  });

  it('does not change any other field', () => {
    const updated = recalculateRoomArea(room);
    expect(updated.id).toBe(room.id);
    expect(updated.name).toBe(room.name);
    expect(updated.calculatedBoundary).toEqual(room.calculatedBoundary);
    expect(updated.status).toBe(room.status);
  });

  it('recomputes to 0 if the boundary is degenerate', () => {
    const degenerateRoom = { ...room, calculatedBoundary: [] };
    expect(recalculateRoomArea(degenerateRoom).calculatedArea).toBe(0);
  });
});

describe('roomAreaIsTooSmall', () => {
  it('is true when the area is below the caller-supplied minimum', () => {
    expect(roomAreaIsTooSmall(1.5, 2)).toBe(true);
  });

  it('is false when the area meets or exceeds the caller-supplied minimum', () => {
    expect(roomAreaIsTooSmall(2, 2)).toBe(false);
    expect(roomAreaIsTooSmall(12, 2)).toBe(false);
  });
});
