import { describe, expect, it } from 'vitest';
import { length } from './length';
import { windowTypeId } from './ids';
import { createWindowType } from './window-type';

describe('createWindowType', () => {
  it('constructs a window type with the given defaults', () => {
    const windowType = createWindowType({
      id: windowTypeId('wt-1'),
      name: 'Standard casement',
      defaultWidth: length(1200, 'mm'),
      defaultHeight: length(1200, 'mm'),
      defaultSillHeight: length(900, 'mm'),
    });
    expect(windowType.id).toBe('wt-1');
    expect(windowType.name).toBe('Standard casement');
    expect(windowType.defaultWidth).toEqual(length(1200, 'mm'));
    expect(windowType.defaultHeight).toEqual(length(1200, 'mm'));
    expect(windowType.defaultSillHeight).toEqual(length(900, 'mm'));
  });

  it('accepts a zero defaultSillHeight (a full-height window type)', () => {
    const windowType = createWindowType({
      id: windowTypeId('wt-1'),
      name: 'Full height',
      defaultWidth: length(1200, 'mm'),
      defaultHeight: length(2400, 'mm'),
      defaultSillHeight: length(0, 'mm'),
    });
    expect(windowType.defaultSillHeight).toEqual(length(0, 'mm'));
  });

  it('rejects a non-positive defaultWidth', () => {
    expect(() =>
      createWindowType({
        id: windowTypeId('wt-1'),
        name: 'Bad',
        defaultWidth: length(0, 'mm'),
        defaultHeight: length(1200, 'mm'),
        defaultSillHeight: length(900, 'mm'),
      }),
    ).toThrow(RangeError);
  });

  it('rejects a non-positive defaultHeight', () => {
    expect(() =>
      createWindowType({
        id: windowTypeId('wt-1'),
        name: 'Bad',
        defaultWidth: length(1200, 'mm'),
        defaultHeight: length(-1, 'mm'),
        defaultSillHeight: length(900, 'mm'),
      }),
    ).toThrow(RangeError);
  });

  it('rejects a negative defaultSillHeight', () => {
    expect(() =>
      createWindowType({
        id: windowTypeId('wt-1'),
        name: 'Bad',
        defaultWidth: length(1200, 'mm'),
        defaultHeight: length(1200, 'mm'),
        defaultSillHeight: length(-1, 'mm'),
      }),
    ).toThrow(RangeError);
  });

  it('rejects non-finite dimensions (adversarial: non-finite values)', () => {
    expect(() =>
      createWindowType({
        id: windowTypeId('wt-1'),
        name: 'Bad',
        defaultWidth: length(Number.NaN, 'mm'),
        defaultHeight: length(1200, 'mm'),
        defaultSillHeight: length(900, 'mm'),
      }),
    ).toThrow(RangeError);
  });
});
