import { describe, expect, it } from 'vitest';
import { worldPoint } from '@arq/geometry-2d';
import { length } from './length';
import { levelId, wallId, wallTypeId } from './ids';
import { createWall } from './wall-instance';
import { createWallType } from './wall-type';
import { offsetWall } from './offset-wall';

const wallType = createWallType({
  id: wallTypeId('wt-1'),
  name: 'Standard',
  thickness: length(100, 'mm'),
  defaultHeight: length(2400, 'mm'),
});

const original = createWall({
  id: wallId('w-1'),
  typeId: wallType.id,
  levelId: levelId('l-1'),
  start: worldPoint(0, 0),
  end: worldPoint(10, 0),
  joinStart: 'butt',
  joinEnd: 'mitre',
});

describe('offsetWall', () => {
  it('creates a new wall parallel to the original, shifted by the given distance', () => {
    const result = offsetWall(original, 2, wallId('w-2'), 1e-9)!;
    expect(result.start).toEqual(worldPoint(0, 2));
    expect(result.end).toEqual(worldPoint(10, 2));
  });

  it('does not modify the original wall', () => {
    offsetWall(original, 2, wallId('w-2'), 1e-9);
    expect(original.start).toEqual(worldPoint(0, 0));
    expect(original.end).toEqual(worldPoint(10, 0));
  });

  it('gives the new wall its own id', () => {
    const result = offsetWall(original, 2, wallId('w-2'), 1e-9)!;
    expect(result.id).toBe('w-2');
  });

  it('resets joinStart and joinEnd to auto on the offset copy rather than inheriting the source join intents', () => {
    const result = offsetWall(original, 2, wallId('w-2'), 1e-9)!;
    expect(result.joinStart).toBe('auto');
    expect(result.joinEnd).toBe('auto');
  });

  it('clears hostedOpeningIds rather than carrying openings to a wall they no longer sit on', () => {
    const result = offsetWall(original, 2, wallId('w-2'), 1e-9)!;
    expect(result.hostedOpeningIds).toEqual([]);
  });

  it('preserves typeId, levelId, and alignment', () => {
    const result = offsetWall(original, 2, wallId('w-2'), 1e-9)!;
    expect(result.typeId).toBe(original.typeId);
    expect(result.levelId).toBe(original.levelId);
    expect(result.alignment).toBe(original.alignment);
  });

  it('a negative distance offsets to the other side', () => {
    const result = offsetWall(original, -2, wallId('w-2'), 1e-9)!;
    expect(result.start).toEqual(worldPoint(0, -2));
    expect(result.end).toEqual(worldPoint(10, -2));
  });

  it('returns null for a degenerate (zero-length) wall (adversarial: zero-length segments)', () => {
    const degenerate = createWall({
      id: wallId('w-zero'),
      typeId: wallType.id,
      levelId: levelId('l-1'),
      start: worldPoint(5, 5),
      end: worldPoint(5, 5),
    });
    expect(offsetWall(degenerate, 2, wallId('w-2'), 1e-9)).toBeNull();
  });
});
