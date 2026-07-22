import { describe, expect, it } from 'vitest';
import { worldPoint } from '@arq/geometry-2d';
import { elementId, levelId, roomId } from './ids';
import { createRoom, type CreateRoomInput } from './room';

const validSquareBoundary = [
  worldPoint(0, 0),
  worldPoint(4000, 0),
  worldPoint(4000, 3000),
  worldPoint(0, 3000),
];

const baseInput: CreateRoomInput = {
  id: roomId('r-1'),
  levelId: levelId('l-1'),
  seedPoint: worldPoint(2000, 1500),
  name: 'Living Room',
  boundaryElementIds: [elementId('w-1'), elementId('w-2'), elementId('w-3'), elementId('w-4')],
  calculatedBoundary: validSquareBoundary,
  calculatedArea: 12_000_000,
  status: 'valid',
};

describe('createRoom', () => {
  it('constructs a room with the given fields', () => {
    const room = createRoom(baseInput);
    expect(room.id).toBe('r-1');
    expect(room.levelId).toBe('l-1');
    expect(room.seedPoint).toEqual(worldPoint(2000, 1500));
    expect(room.name).toBe('Living Room');
    expect(room.number).toBeUndefined();
    expect(room.boundaryElementIds).toEqual(baseInput.boundaryElementIds);
    expect(room.calculatedBoundary).toEqual(validSquareBoundary);
    expect(room.calculatedArea).toBe(12_000_000);
    expect(room.status).toBe('valid');
  });

  it('accepts an optional room number', () => {
    const room = createRoom({ ...baseInput, number: '101' });
    expect(room.number).toBe('101');
  });

  it('accepts every status from blueprint section 49', () => {
    const statuses = [
      'valid',
      'not-enclosed',
      'overlapping',
      'too-small',
      'invalid-polygon',
      'stale',
    ] as const;
    for (const status of statuses) {
      const room = createRoom({
        ...baseInput,
        status,
        calculatedBoundary: status === 'valid' ? validSquareBoundary : [],
      });
      expect(room.status).toBe(status);
    }
  });

  it('allows a non-valid room to have an empty calculatedBoundary (not yet enclosed)', () => {
    const room = createRoom({
      ...baseInput,
      status: 'not-enclosed',
      calculatedBoundary: [],
      calculatedArea: 0,
    });
    expect(room.calculatedBoundary).toEqual([]);
  });

  it("rejects a 'valid' status paired with a boundary of fewer than 3 points", () => {
    expect(() =>
      createRoom({
        ...baseInput,
        status: 'valid',
        calculatedBoundary: [worldPoint(0, 0), worldPoint(1, 1)],
      }),
    ).toThrow(RangeError);
  });

  it("rejects a 'valid' status paired with an empty boundary", () => {
    expect(() => createRoom({ ...baseInput, status: 'valid', calculatedBoundary: [] })).toThrow(
      RangeError,
    );
  });

  it('rejects a negative calculatedArea', () => {
    expect(() => createRoom({ ...baseInput, calculatedArea: -1 })).toThrow(RangeError);
  });

  it('rejects a non-finite calculatedArea (adversarial: non-finite values)', () => {
    expect(() => createRoom({ ...baseInput, calculatedArea: Number.NaN })).toThrow(RangeError);
    expect(() =>
      createRoom({ ...baseInput, calculatedArea: Number.POSITIVE_INFINITY }),
    ).toThrow(RangeError);
  });

  it('accepts a zero calculatedArea (a too-small or degenerate room)', () => {
    const room = createRoom({
      ...baseInput,
      status: 'too-small',
      calculatedArea: 0,
      calculatedBoundary: [],
    });
    expect(room.calculatedArea).toBe(0);
  });

  it('does not share array identity with the caller-supplied boundaryElementIds/calculatedBoundary', () => {
    const boundaryElementIds = [elementId('w-1')];
    const calculatedBoundary = [worldPoint(0, 0)];
    const room = createRoom({
      ...baseInput,
      boundaryElementIds,
      calculatedBoundary,
      status: 'not-enclosed',
    });
    expect(room.boundaryElementIds).not.toBe(boundaryElementIds);
    expect(room.calculatedBoundary).not.toBe(calculatedBoundary);
  });
});
