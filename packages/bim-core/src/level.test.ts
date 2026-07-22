import { describe, expect, it } from 'vitest';
import { levelId } from './ids';
import { createLevel, sortLevelsByElevation } from './level';

describe('createLevel', () => {
  it('constructs a level without a storey height', () => {
    const level = createLevel({ id: levelId('l1'), name: 'Ground Floor', elevation: 0 });
    expect(level).toEqual({ id: 'l1', name: 'Ground Floor', elevation: 0 });
  });

  it('constructs a level with a storey height', () => {
    const level = createLevel({
      id: levelId('l1'),
      name: 'First Floor',
      elevation: 3000,
      storeyHeight: 3000,
    });
    expect(level.storeyHeight).toBe(3000);
  });

  it('rejects a non-finite elevation', () => {
    expect(() => createLevel({ id: levelId('l1'), name: 'X', elevation: NaN })).toThrow(RangeError);
    expect(() => createLevel({ id: levelId('l1'), name: 'X', elevation: Infinity })).toThrow(
      RangeError,
    );
  });

  it('rejects a non-positive storey height', () => {
    expect(() =>
      createLevel({ id: levelId('l1'), name: 'X', elevation: 0, storeyHeight: 0 }),
    ).toThrow(RangeError);
    expect(() =>
      createLevel({ id: levelId('l1'), name: 'X', elevation: 0, storeyHeight: -100 }),
    ).toThrow(RangeError);
  });
});

describe('sortLevelsByElevation', () => {
  it('sorts levels lowest elevation first', () => {
    const roof = createLevel({ id: levelId('roof'), name: 'Roof', elevation: 6000 });
    const ground = createLevel({ id: levelId('ground'), name: 'Ground', elevation: 0 });
    const first = createLevel({ id: levelId('first'), name: 'First', elevation: 3000 });
    expect(sortLevelsByElevation([roof, ground, first]).map((l) => l.id)).toEqual([
      'ground',
      'first',
      'roof',
    ]);
  });

  it('does not mutate the input array', () => {
    const levels = [
      createLevel({ id: levelId('b'), name: 'B', elevation: 10 }),
      createLevel({ id: levelId('a'), name: 'A', elevation: 0 }),
    ];
    const copy = [...levels];
    sortLevelsByElevation(levels);
    expect(levels).toEqual(copy);
  });
});
