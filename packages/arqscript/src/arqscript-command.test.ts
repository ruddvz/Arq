import { describe, expect, it } from 'vitest';
import {
  DEFAULT_DOOR_HEIGHT_MM,
  DEFAULT_DOOR_WIDTH_MM,
  DEFAULT_WALL_HEIGHT_MM,
  DEFAULT_WALL_TYPE,
  DEFAULT_WINDOW_HEIGHT_MM,
  DEFAULT_WINDOW_SILL_HEIGHT_MM,
  DEFAULT_WINDOW_WIDTH_MM,
  createDimensionCommand,
  createDoorCommand,
  createLevelCommand,
  createRenameCommand,
  createRoomCommand,
  createSelectByCategoryCommand,
  createSelectByIdCommand,
  createUnitsCommand,
  createUpdateWallCommand,
  createWallCommand,
  createWindowCommand,
} from './arqscript-command';

describe('createUnitsCommand', () => {
  it('constructs a units command for the metric system, matching the pre-existing ARQSCRIPT-GRAMMAR.ebnf draft', () => {
    expect(createUnitsCommand('metric')).toEqual({
      kind: 'units',
      operationType: 'DefineProjectUnits',
      unit: 'metric',
      assumptions: [],
    });
  });

  it('constructs a units command for the imperial system', () => {
    expect(createUnitsCommand('imperial').unit).toBe('imperial');
  });
});

describe('createLevelCommand', () => {
  it('constructs a level command matching section 98\'s example ("Ground Floor" elevation 0mm)', () => {
    expect(createLevelCommand({ name: 'Ground Floor', elevationMm: 0 })).toEqual({
      kind: 'level',
      operationType: 'CreateLevel',
      name: 'Ground Floor',
      elevationMm: 0,
      assumptions: [],
    });
  });

  it('rejects an empty name', () => {
    expect(() => createLevelCommand({ name: '', elevationMm: 0 })).toThrow(RangeError);
  });

  it('rejects a non-finite elevation', () => {
    expect(() => createLevelCommand({ name: 'L1', elevationMm: Number.NaN })).toThrow(RangeError);
  });
});

describe('createWallCommand', () => {
  const from = { xMm: 0, yMm: 0 };
  const to = { xMm: 6000, yMm: 0 };

  it("constructs a wall command matching section 98's example, with no assumptions when every field is given", () => {
    const wall = createWallCommand({
      id: 'W1',
      from,
      to,
      wallType: 'Exterior 230',
      heightMm: 3000,
    });
    expect(wall).toEqual({
      kind: 'wall',
      operationType: 'CreateWall',
      id: 'W1',
      from,
      to,
      wallType: 'Exterior 230',
      heightMm: 3000,
      assumptions: [],
    });
  });

  it('fills in a default wall type and height, recording each as an assumption', () => {
    const wall = createWallCommand({ id: 'W1', from, to });
    expect(wall.wallType).toBe(DEFAULT_WALL_TYPE);
    expect(wall.heightMm).toBe(DEFAULT_WALL_HEIGHT_MM);
    expect(wall.assumptions).toHaveLength(2);
  });

  it('rejects an empty id', () => {
    expect(() => createWallCommand({ id: '', from, to })).toThrow(RangeError);
  });

  it('rejects a negative coordinate', () => {
    expect(() => createWallCommand({ id: 'W1', from: { xMm: -1, yMm: 0 }, to })).toThrow(
      RangeError,
    );
  });

  it('rejects a negative height when explicitly given', () => {
    expect(() => createWallCommand({ id: 'W1', from, to, heightMm: -1 })).toThrow(RangeError);
  });
});

describe('createUpdateWallCommand', () => {
  it('updates the wall type', () => {
    expect(createUpdateWallCommand({ id: 'W1', wallType: 'Interior 100' })).toEqual({
      kind: 'update-wall',
      operationType: 'UpdateWall',
      id: 'W1',
      wallType: 'Interior 100',
      assumptions: [],
    });
  });

  it('rejects an update with nothing to change', () => {
    expect(() => createUpdateWallCommand({ id: 'W1' })).toThrow(RangeError);
  });

  it('rejects a negative height', () => {
    expect(() => createUpdateWallCommand({ id: 'W1', heightMm: -1 })).toThrow(RangeError);
  });
});

describe('createDoorCommand', () => {
  it("constructs a door command matching section 98's example, with no assumptions when width/height are given", () => {
    const door = createDoorCommand({
      id: 'D1',
      hostWallId: 'W1',
      widthMm: 900,
      heightMm: 2100,
      offsetMm: 1200,
    });
    expect(door).toEqual({
      kind: 'door',
      operationType: 'PlaceDoor',
      id: 'D1',
      hostWallId: 'W1',
      widthMm: 900,
      heightMm: 2100,
      offsetMm: 1200,
      assumptions: [],
    });
  });

  it('fills in default width and height, recording each as an assumption', () => {
    const door = createDoorCommand({ id: 'D1', hostWallId: 'W1', offsetMm: 1200 });
    expect(door.widthMm).toBe(DEFAULT_DOOR_WIDTH_MM);
    expect(door.heightMm).toBe(DEFAULT_DOOR_HEIGHT_MM);
    expect(door.assumptions).toHaveLength(2);
  });

  it('rejects an empty host', () => {
    expect(() => createDoorCommand({ id: 'D1', hostWallId: '', offsetMm: 0 })).toThrow(RangeError);
  });
});

describe('createWindowCommand', () => {
  it('fills in default width, height and sill height, recording each as an assumption', () => {
    const win = createWindowCommand({ id: 'WIN1', hostWallId: 'W1', offsetMm: 1000 });
    expect(win.widthMm).toBe(DEFAULT_WINDOW_WIDTH_MM);
    expect(win.heightMm).toBe(DEFAULT_WINDOW_HEIGHT_MM);
    expect(win.sillHeightMm).toBe(DEFAULT_WINDOW_SILL_HEIGHT_MM);
    expect(win.assumptions).toHaveLength(3);
  });

  it('takes explicit values with no assumptions', () => {
    const win = createWindowCommand({
      id: 'WIN1',
      hostWallId: 'W1',
      widthMm: 1500,
      heightMm: 1400,
      sillHeightMm: 850,
      offsetMm: 1000,
    });
    expect(win.assumptions).toEqual([]);
  });
});

describe('createRoomCommand', () => {
  const boundary = [
    { xMm: 0, yMm: 0 },
    { xMm: 4000, yMm: 0 },
    { xMm: 4000, yMm: 3000 },
    { xMm: 0, yMm: 3000 },
  ];

  it('constructs a room command', () => {
    expect(createRoomCommand({ id: 'R1', name: 'Kitchen', boundary })).toEqual({
      kind: 'room',
      operationType: 'CreateRoom',
      id: 'R1',
      name: 'Kitchen',
      boundary,
      assumptions: [],
    });
  });

  it('rejects a boundary with fewer than 3 points', () => {
    expect(() =>
      createRoomCommand({ id: 'R1', name: 'Kitchen', boundary: boundary.slice(0, 2) }),
    ).toThrow(RangeError);
  });
});

describe('createDimensionCommand', () => {
  it('constructs a dimension command', () => {
    const from = { xMm: 0, yMm: 0 };
    const to = { xMm: 6000, yMm: 0 };
    expect(createDimensionCommand({ id: 'DIM1', from, to })).toEqual({
      kind: 'dimension',
      operationType: 'AddDimension',
      id: 'DIM1',
      from,
      to,
      assumptions: [],
    });
  });
});

describe('createSelectByIdCommand / createSelectByCategoryCommand', () => {
  it('constructs a select-by-id command', () => {
    expect(createSelectByIdCommand(['W1', 'W2'])).toEqual({
      kind: 'select-id',
      operationType: 'Select',
      ids: ['W1', 'W2'],
      assumptions: [],
    });
  });

  it('rejects an empty id list', () => {
    expect(() => createSelectByIdCommand([])).toThrow(RangeError);
  });

  it('constructs a select-by-category command', () => {
    expect(createSelectByCategoryCommand('Wall')).toEqual({
      kind: 'select-category',
      operationType: 'Select',
      category: 'Wall',
      assumptions: [],
    });
  });
});

describe('createRenameCommand', () => {
  it('constructs a rename command', () => {
    expect(createRenameCommand({ id: 'R1', newName: 'Living Room' })).toEqual({
      kind: 'rename',
      operationType: 'Rename',
      id: 'R1',
      newName: 'Living Room',
      assumptions: [],
    });
  });

  it('rejects an empty newName', () => {
    expect(() => createRenameCommand({ id: 'R1', newName: '' })).toThrow(RangeError);
  });
});
