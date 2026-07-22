import { describe, expect, it } from 'vitest';
import { length } from './length';
import { doorId, doorTypeId, levelId, openingId, wallId } from './ids';
import { createDoorType } from './door-type';
import { createOpening } from './opening';
import {
  createDoor,
  flipHand,
  flipSide,
  resolveDoorHeight,
  resolveDoorWidth,
} from './door-instance';

const doorType = createDoorType({
  id: doorTypeId('dt-1'),
  name: 'Single leaf',
  defaultWidth: length(900, 'mm'),
  defaultHeight: length(2100, 'mm'),
});

const matchingOpening = createOpening({
  id: openingId('o-1'),
  hostWallId: wallId('w-1'),
  kind: 'door',
  offsetFromWallStart: length(500, 'mm'),
  width: length(900, 'mm'),
  sillHeight: length(0, 'mm'),
  height: length(2100, 'mm'),
});

describe('createDoor', () => {
  it('constructs a door defaulting side, hand, and swingAngle', () => {
    const door = createDoor({
      id: doorId('d-1'),
      typeId: doorType.id,
      openingId: matchingOpening.id,
      levelId: levelId('l-1'),
    });
    expect(door.side).toBe('right');
    expect(door.hand).toBe('right');
    expect(door.swingAngle).toBe(90);
  });

  it('accepts explicit side, hand, and swingAngle', () => {
    const door = createDoor({
      id: doorId('d-1'),
      typeId: doorType.id,
      openingId: matchingOpening.id,
      levelId: levelId('l-1'),
      side: 'left',
      hand: 'left',
      swingAngle: 120,
    });
    expect(door.side).toBe('left');
    expect(door.hand).toBe('left');
    expect(door.swingAngle).toBe(120);
  });

  it('rejects a zero swingAngle', () => {
    expect(() =>
      createDoor({
        id: doorId('d-1'),
        typeId: doorType.id,
        openingId: matchingOpening.id,
        levelId: levelId('l-1'),
        swingAngle: 0,
      }),
    ).toThrow(RangeError);
  });

  it('rejects a swingAngle beyond 180 degrees', () => {
    expect(() =>
      createDoor({
        id: doorId('d-1'),
        typeId: doorType.id,
        openingId: matchingOpening.id,
        levelId: levelId('l-1'),
        swingAngle: 181,
      }),
    ).toThrow(RangeError);
  });

  it('rejects a non-finite swingAngle (adversarial: non-finite values)', () => {
    expect(() =>
      createDoor({
        id: doorId('d-1'),
        typeId: doorType.id,
        openingId: matchingOpening.id,
        levelId: levelId('l-1'),
        swingAngle: Number.NaN,
      }),
    ).toThrow(RangeError);
  });
});

describe('flipSide / flipHand', () => {
  it('flipSide toggles side and preserves the id and hand', () => {
    const door = createDoor({
      id: doorId('d-1'),
      typeId: doorType.id,
      openingId: matchingOpening.id,
      levelId: levelId('l-1'),
    });
    const flipped = flipSide(door);
    expect(flipped.side).toBe('left');
    expect(flipped.id).toBe(door.id);
    expect(flipped.hand).toBe(door.hand);
  });

  it('flipHand toggles hand and preserves the id and side', () => {
    const door = createDoor({
      id: doorId('d-1'),
      typeId: doorType.id,
      openingId: matchingOpening.id,
      levelId: levelId('l-1'),
    });
    const flipped = flipHand(door);
    expect(flipped.hand).toBe('left');
    expect(flipped.id).toBe(door.id);
    expect(flipped.side).toBe(door.side);
  });

  it('flipping twice returns to the original value', () => {
    const door = createDoor({
      id: doorId('d-1'),
      typeId: doorType.id,
      openingId: matchingOpening.id,
      levelId: levelId('l-1'),
    });
    expect(flipSide(flipSide(door))).toEqual(door);
    expect(flipHand(flipHand(door))).toEqual(door);
  });
});

describe('resolveDoorWidth / resolveDoorHeight', () => {
  const door = createDoor({
    id: doorId('d-1'),
    typeId: doorType.id,
    openingId: matchingOpening.id,
    levelId: levelId('l-1'),
  });

  it('is Inherited when the opening still matches the door type default', () => {
    const width = resolveDoorWidth(door, doorType, matchingOpening);
    expect(width).toEqual({ kind: 'inherited', value: length(900, 'mm'), sourceTypeId: 'dt-1' });

    const height = resolveDoorHeight(door, doorType, matchingOpening);
    expect(height).toEqual({
      kind: 'inherited',
      value: length(2100, 'mm'),
      sourceTypeId: 'dt-1',
    });
  });

  it('is Overridden when the opening width differs from the door type default', () => {
    const widerOpening = createOpening({ ...matchingOpening, width: length(1200, 'mm') });
    const width = resolveDoorWidth(door, doorType, widerOpening);
    expect(width).toEqual({
      kind: 'overridden',
      value: length(1200, 'mm'),
      sourceTypeId: 'dt-1',
    });
  });

  it('is Overridden when the opening height differs from the door type default', () => {
    const tallerOpening = createOpening({ ...matchingOpening, height: length(2400, 'mm') });
    const height = resolveDoorHeight(door, doorType, tallerOpening);
    expect(height).toEqual({
      kind: 'overridden',
      value: length(2400, 'mm'),
      sourceTypeId: 'dt-1',
    });
  });

  it('reflects the door type current default after the type changes, for a door still at the old default', () => {
    const changedType = createDoorType({
      id: doorType.id,
      name: doorType.name,
      defaultWidth: length(1000, 'mm'),
      defaultHeight: doorType.defaultHeight,
    });
    const width = resolveDoorWidth(door, changedType, matchingOpening);
    expect(width).toEqual({
      kind: 'overridden',
      value: length(900, 'mm'),
      sourceTypeId: 'dt-1',
    });
  });
});
