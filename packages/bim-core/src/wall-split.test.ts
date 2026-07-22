import { describe, expect, it } from 'vitest';
import { worldPoint } from '@arq/geometry-2d';
import { length } from './length';
import { levelId, wallId, wallTypeId } from './ids';
import { createWall } from './wall-instance';
import { createWallType } from './wall-type';
import { splitWall } from './wall-split';

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

describe('splitWall', () => {
  it('splits at a midpoint into two walls sharing that point', () => {
    const result = splitWall(original, worldPoint(4, 0), wallId('w-2'), 1e-9);
    expect(result).not.toBeNull();
    expect(result!.first.end).toEqual(worldPoint(4, 0));
    expect(result!.second.start).toEqual(worldPoint(4, 0));
  });

  it('the first half keeps the original id, start point, and joinStart', () => {
    const result = splitWall(original, worldPoint(4, 0), wallId('w-2'), 1e-9)!;
    expect(result.first.id).toBe(original.id);
    expect(result.first.start).toEqual(original.start);
    expect(result.first.joinStart).toBe('butt');
  });

  it('the second half gets the new id and keeps the original end point and joinEnd', () => {
    const result = splitWall(original, worldPoint(4, 0), wallId('w-2'), 1e-9)!;
    expect(result.second.id).toBe('w-2');
    expect(result.second.end).toEqual(original.end);
    expect(result.second.joinEnd).toBe('mitre');
  });

  it('both halves get an auto join at the new shared split point', () => {
    const result = splitWall(original, worldPoint(4, 0), wallId('w-2'), 1e-9)!;
    expect(result.first.joinEnd).toBe('auto');
    expect(result.second.joinStart).toBe('auto');
  });

  it('clears hostedOpeningIds on both halves rather than guessing a distribution', () => {
    const withOpenings = { ...original, hostedOpeningIds: original.hostedOpeningIds };
    const result = splitWall(withOpenings, worldPoint(4, 0), wallId('w-2'), 1e-9)!;
    expect(result.first.hostedOpeningIds).toEqual([]);
    expect(result.second.hostedOpeningIds).toEqual([]);
  });

  it('preserves typeId, levelId, and alignment on both halves', () => {
    const result = splitWall(original, worldPoint(4, 0), wallId('w-2'), 1e-9)!;
    expect(result.first.typeId).toBe(original.typeId);
    expect(result.second.typeId).toBe(original.typeId);
    expect(result.first.levelId).toBe(original.levelId);
    expect(result.first.alignment).toBe(original.alignment);
    expect(result.second.alignment).toBe(original.alignment);
  });

  it("returns null when the split point is not on the wall's centerline", () => {
    expect(splitWall(original, worldPoint(4, 5), wallId('w-2'), 1e-9)).toBeNull();
  });

  it("returns null when the split point coincides with the wall's start (would produce a zero-length half)", () => {
    expect(splitWall(original, worldPoint(0, 0), wallId('w-2'), 1e-9)).toBeNull();
  });

  it("returns null when the split point coincides with the wall's end", () => {
    expect(splitWall(original, worldPoint(10, 0), wallId('w-2'), 1e-9)).toBeNull();
  });
});
