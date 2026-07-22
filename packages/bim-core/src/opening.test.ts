import { describe, expect, it } from 'vitest';
import { worldPoint } from '@arq/geometry-2d';
import { length } from './length';
import { levelId, openingId, wallId, wallTypeId } from './ids';
import { createWall } from './wall-instance';
import { createWallType } from './wall-type';
import {
  createOpening,
  openingFitsWallHeight,
  openingFitsWallLength,
  type CreateOpeningInput,
} from './opening';

const wallType = createWallType({
  id: wallTypeId('wt-1'),
  name: 'Standard',
  thickness: length(100, 'mm'),
  defaultHeight: length(2400, 'mm'),
});

const wall = createWall({
  id: wallId('w-1'),
  typeId: wallType.id,
  levelId: levelId('l-1'),
  start: worldPoint(0, 0),
  end: worldPoint(4000, 0),
});

const baseInput: CreateOpeningInput = {
  id: openingId('o-1'),
  hostWallId: wall.id,
  kind: 'door',
  offsetFromWallStart: length(500, 'mm'),
  width: length(900, 'mm'),
  sillHeight: length(0, 'mm'),
  height: length(2100, 'mm'),
};

describe('createOpening', () => {
  it('constructs an opening with the given fields', () => {
    const opening = createOpening(baseInput);
    expect(opening.id).toBe('o-1');
    expect(opening.hostWallId).toBe(wall.id);
    expect(opening.kind).toBe('door');
    expect(opening.offsetFromWallStart).toEqual(length(500, 'mm'));
    expect(opening.width).toEqual(length(900, 'mm'));
    expect(opening.sillHeight).toEqual(length(0, 'mm'));
    expect(opening.height).toEqual(length(2100, 'mm'));
  });

  it('accepts a window kind with a non-zero sill height', () => {
    const opening = createOpening({
      ...baseInput,
      id: openingId('o-2'),
      kind: 'window',
      sillHeight: length(900, 'mm'),
      height: length(1200, 'mm'),
    });
    expect(opening.kind).toBe('window');
    expect(opening.sillHeight).toEqual(length(900, 'mm'));
  });

  it('accepts a bare void kind', () => {
    const opening = createOpening({ ...baseInput, id: openingId('o-3'), kind: 'void' });
    expect(opening.kind).toBe('void');
  });

  it('rejects a non-positive width', () => {
    expect(() => createOpening({ ...baseInput, width: length(0, 'mm') })).toThrow(RangeError);
    expect(() => createOpening({ ...baseInput, width: length(-100, 'mm') })).toThrow(RangeError);
  });

  it('rejects a non-positive height', () => {
    expect(() => createOpening({ ...baseInput, height: length(0, 'mm') })).toThrow(RangeError);
  });

  it('rejects a negative sillHeight', () => {
    expect(() => createOpening({ ...baseInput, sillHeight: length(-1, 'mm') })).toThrow(
      RangeError,
    );
  });

  it('rejects a negative offsetFromWallStart', () => {
    expect(() =>
      createOpening({ ...baseInput, offsetFromWallStart: length(-1, 'mm') }),
    ).toThrow(RangeError);
  });

  it('rejects non-finite dimensions (adversarial: non-finite values)', () => {
    expect(() => createOpening({ ...baseInput, width: length(Number.NaN, 'mm') })).toThrow(
      RangeError,
    );
    expect(() =>
      createOpening({ ...baseInput, height: length(Number.POSITIVE_INFINITY, 'mm') }),
    ).toThrow(RangeError);
  });
});

describe('openingFitsWallLength', () => {
  it('is true for an opening that fits entirely within the host wall', () => {
    const opening = createOpening(baseInput);
    expect(openingFitsWallLength(opening, wall)).toBe(true);
  });

  it('is true for an opening whose far edge lands exactly on the wall end (touching wall end, blueprint section 42)', () => {
    const opening = createOpening({
      ...baseInput,
      offsetFromWallStart: length(3100, 'mm'),
      width: length(900, 'mm'),
    });
    expect(openingFitsWallLength(opening, wall)).toBe(true);
  });

  it('is false for an opening that extends beyond the host wall', () => {
    const opening = createOpening({
      ...baseInput,
      offsetFromWallStart: length(3500, 'mm'),
      width: length(900, 'mm'),
    });
    expect(openingFitsWallLength(opening, wall)).toBe(false);
  });

  it('is false for an opening whose offset alone is already beyond the wall', () => {
    const opening = createOpening({ ...baseInput, offsetFromWallStart: length(5000, 'mm') });
    expect(openingFitsWallLength(opening, wall)).toBe(false);
  });
});

describe('openingFitsWallHeight', () => {
  it('is true for a door (zero sill) that fits within the wall default height', () => {
    const opening = createOpening(baseInput);
    expect(openingFitsWallHeight(opening, wall, wallType)).toBe(true);
  });

  it('is true for a window whose sill-to-head span fits within the wall height', () => {
    const opening = createOpening({
      ...baseInput,
      kind: 'window',
      sillHeight: length(900, 'mm'),
      height: length(1200, 'mm'),
    });
    expect(openingFitsWallHeight(opening, wall, wallType)).toBe(true);
  });

  it('is false for an opening whose sill-to-head span exceeds the wall height', () => {
    const opening = createOpening({
      ...baseInput,
      kind: 'window',
      sillHeight: length(900, 'mm'),
      height: length(2000, 'mm'),
    });
    expect(openingFitsWallHeight(opening, wall, wallType)).toBe(false);
  });

  it('respects a wall height override rather than only the wall type default', () => {
    const tallWall = { ...wall, heightOverride: length(3000, 'mm') };
    const opening = createOpening({ ...baseInput, height: length(2900, 'mm') });
    expect(openingFitsWallHeight(opening, tallWall, wallType)).toBe(true);
    expect(openingFitsWallHeight(createOpening(baseInput), wall, wallType)).toBe(true);
  });
});
