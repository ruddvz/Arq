import { describe, expect, it } from 'vitest';
import { worldPoint } from '@arq/geometry-2d';
import { length } from './length';
import { levelId, wallId, wallTypeId } from './ids';
import { createWallType } from './wall-type';
import {
  createWall,
  effectiveWallHeight,
  resetWallHeightOverride,
  resolveWallHeight,
} from './wall-instance';

const wallType = createWallType({
  id: wallTypeId('wt-1'),
  name: 'Standard interior',
  thickness: length(100, 'mm'),
  defaultHeight: length(2400, 'mm'),
});

const baseInput = {
  id: wallId('w-1'),
  typeId: wallType.id,
  levelId: levelId('l-1'),
  start: worldPoint(0, 0),
  end: worldPoint(5000, 0),
};

describe('createWall', () => {
  it('defaults alignment to centre, joins to auto, and no hosted openings', () => {
    const wall = createWall(baseInput);
    expect(wall.alignment).toBe('centre');
    expect(wall.joinStart).toBe('auto');
    expect(wall.joinEnd).toBe('auto');
    expect(wall.hostedOpeningIds).toEqual([]);
    expect(wall.heightOverride).toBeUndefined();
  });

  it('accepts an explicit alignment, join intents, and height override', () => {
    const wall = createWall({
      ...baseInput,
      alignment: 'interior',
      joinStart: 'butt',
      joinEnd: 'disallow',
      heightOverride: length(2700, 'mm'),
    });
    expect(wall.alignment).toBe('interior');
    expect(wall.joinStart).toBe('butt');
    expect(wall.joinEnd).toBe('disallow');
    expect(wall.heightOverride).toEqual({ value: 2700, unit: 'mm' });
  });
});

describe('resolveWallHeight', () => {
  it('is Inherited from the type when no override is set', () => {
    const wall = createWall(baseInput);
    expect(resolveWallHeight(wall, wallType)).toEqual({
      kind: 'inherited',
      value: { value: 2400, unit: 'mm' },
      sourceTypeId: 'wt-1',
    });
  });

  it('is Overridden when heightOverride is set', () => {
    const wall = createWall({ ...baseInput, heightOverride: length(3000, 'mm') });
    expect(resolveWallHeight(wall, wallType)).toEqual({
      kind: 'overridden',
      value: { value: 3000, unit: 'mm' },
      sourceTypeId: 'wt-1',
    });
  });
});

describe('resetWallHeightOverride', () => {
  it('clears the override so the wall reads through to the type again', () => {
    const overridden = createWall({ ...baseInput, heightOverride: length(3000, 'mm') });
    const reset = resetWallHeightOverride(overridden);
    expect(reset.heightOverride).toBeUndefined();
    expect(resolveWallHeight(reset, wallType).kind).toBe('inherited');
  });

  it("reflects the type's *current* defaultHeight after reset, not a frozen snapshot", () => {
    const overridden = createWall({ ...baseInput, heightOverride: length(3000, 'mm') });
    const reset = resetWallHeightOverride(overridden);
    const changedType = createWallType({ ...wallType, defaultHeight: length(2600, 'mm') });
    expect(effectiveWallHeight(reset, changedType).value).toBe(2600);
  });

  it('is a no-op when there is no override to clear', () => {
    const wall = createWall(baseInput);
    expect(resetWallHeightOverride(wall)).toEqual(wall);
  });
});

describe('effectiveWallHeight', () => {
  it('returns the inherited value when unset', () => {
    const wall = createWall(baseInput);
    expect(effectiveWallHeight(wall, wallType)).toEqual({ value: 2400, unit: 'mm' });
  });

  it('returns the overridden value when set', () => {
    const wall = createWall({ ...baseInput, heightOverride: length(3000, 'mm') });
    expect(effectiveWallHeight(wall, wallType)).toEqual({ value: 3000, unit: 'mm' });
  });
});
