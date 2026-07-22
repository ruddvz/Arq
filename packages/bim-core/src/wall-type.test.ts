import { describe, expect, it } from 'vitest';
import { length } from './length';
import { wallTypeId } from './ids';
import { createWallType, WALL_TYPE_DERIVED_INVALIDATIONS } from './wall-type';

describe('createWallType', () => {
  it('constructs a wall type, defaulting function to unknown', () => {
    const wallType = createWallType({
      id: wallTypeId('wt-1'),
      name: 'Standard interior',
      thickness: length(100, 'mm'),
      defaultHeight: length(2400, 'mm'),
    });
    expect(wallType).toEqual({
      id: 'wt-1',
      name: 'Standard interior',
      thickness: { value: 100, unit: 'mm' },
      defaultHeight: { value: 2400, unit: 'mm' },
      function: 'unknown',
    });
  });

  it('accepts an explicit function', () => {
    const wallType = createWallType({
      id: wallTypeId('wt-1'),
      name: 'Exterior brick',
      thickness: length(300, 'mm'),
      defaultHeight: length(3000, 'mm'),
      function: 'exterior',
    });
    expect(wallType.function).toBe('exterior');
  });

  it('rejects a non-positive thickness', () => {
    expect(() =>
      createWallType({
        id: wallTypeId('wt-1'),
        name: 'X',
        thickness: length(0, 'mm'),
        defaultHeight: length(2400, 'mm'),
      }),
    ).toThrow(RangeError);
    expect(() =>
      createWallType({
        id: wallTypeId('wt-1'),
        name: 'X',
        thickness: length(-10, 'mm'),
        defaultHeight: length(2400, 'mm'),
      }),
    ).toThrow(RangeError);
  });

  it('rejects a non-positive default height', () => {
    expect(() =>
      createWallType({
        id: wallTypeId('wt-1'),
        name: 'X',
        thickness: length(100, 'mm'),
        defaultHeight: length(0, 'mm'),
      }),
    ).toThrow(RangeError);
  });
});

describe('WALL_TYPE_DERIVED_INVALIDATIONS', () => {
  it('names at least the outline, room boundary, and dimension invalidations', () => {
    expect(WALL_TYPE_DERIVED_INVALIDATIONS).toContain('wall-outline');
    expect(WALL_TYPE_DERIVED_INVALIDATIONS).toContain('room-boundary');
    expect(WALL_TYPE_DERIVED_INVALIDATIONS).toContain('dimensions');
  });
});
