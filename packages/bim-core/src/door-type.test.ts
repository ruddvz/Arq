import { describe, expect, it } from 'vitest';
import { length } from './length';
import { doorTypeId } from './ids';
import { createDoorType } from './door-type';

describe('createDoorType', () => {
  it('constructs a door type with the given defaults', () => {
    const doorType = createDoorType({
      id: doorTypeId('dt-1'),
      name: 'Single leaf',
      defaultWidth: length(900, 'mm'),
      defaultHeight: length(2100, 'mm'),
    });
    expect(doorType.id).toBe('dt-1');
    expect(doorType.name).toBe('Single leaf');
    expect(doorType.defaultWidth).toEqual(length(900, 'mm'));
    expect(doorType.defaultHeight).toEqual(length(2100, 'mm'));
  });

  it('rejects a non-positive defaultWidth', () => {
    expect(() =>
      createDoorType({
        id: doorTypeId('dt-1'),
        name: 'Bad',
        defaultWidth: length(0, 'mm'),
        defaultHeight: length(2100, 'mm'),
      }),
    ).toThrow(RangeError);
  });

  it('rejects a non-positive defaultHeight', () => {
    expect(() =>
      createDoorType({
        id: doorTypeId('dt-1'),
        name: 'Bad',
        defaultWidth: length(900, 'mm'),
        defaultHeight: length(-1, 'mm'),
      }),
    ).toThrow(RangeError);
  });

  it('rejects non-finite dimensions (adversarial: non-finite values)', () => {
    expect(() =>
      createDoorType({
        id: doorTypeId('dt-1'),
        name: 'Bad',
        defaultWidth: length(Number.NaN, 'mm'),
        defaultHeight: length(2100, 'mm'),
      }),
    ).toThrow(RangeError);
  });
});
