import { describe, expect, it } from 'vitest';
import { worldPoint } from '@arq/geometry-2d';
import {
  applyOperation,
  invertOperation,
  operationLabel,
  wallLength,
  type DrawnWall,
} from './plan-document';

const WALL_A: DrawnWall = { id: 'w-a', start: worldPoint(0, 0), end: worldPoint(3000, 0) };
const WALL_B: DrawnWall = { id: 'w-b', start: worldPoint(3000, 0), end: worldPoint(3000, 4000) };

describe('applyOperation', () => {
  it('adds walls', () => {
    const walls = applyOperation([], { kind: 'add-walls', walls: [WALL_A, WALL_B] });
    expect(walls.map((wall) => wall.id)).toEqual(['w-a', 'w-b']);
  });

  it('re-adding an existing id replaces rather than duplicates', () => {
    const walls = applyOperation([WALL_A], { kind: 'add-walls', walls: [WALL_A] });
    expect(walls).toHaveLength(1);
  });

  it('removes only the named walls', () => {
    const walls = applyOperation([WALL_A, WALL_B], { kind: 'remove-walls', wallIds: ['w-a'] });
    expect(walls.map((wall) => wall.id)).toEqual(['w-b']);
  });

  it('note operations change nothing', () => {
    const walls = [WALL_A];
    expect(applyOperation(walls, { kind: 'note', label: 'share' })).toBe(walls);
  });
});

describe('invertOperation', () => {
  it('inverts add as remove of the same ids', () => {
    expect(invertOperation([], { kind: 'add-walls', walls: [WALL_A] })).toEqual({
      kind: 'remove-walls',
      wallIds: ['w-a'],
    });
  });

  it('inverts remove as add of the removed walls, captured from current state', () => {
    const inverse = invertOperation([WALL_A, WALL_B], {
      kind: 'remove-walls',
      wallIds: ['w-b'],
    });
    expect(inverse).toEqual({ kind: 'add-walls', walls: [WALL_B] });
  });

  it('round-trips: apply then apply-inverse restores the wall list', () => {
    const before: readonly DrawnWall[] = [WALL_A, WALL_B];
    const operation = { kind: 'remove-walls', wallIds: ['w-a'] } as const;
    const inverse = invertOperation(before, operation);
    const after = applyOperation(applyOperation(before, operation), inverse);
    expect(new Set(after.map((wall) => wall.id))).toEqual(new Set(['w-a', 'w-b']));
  });
});

describe('labels and measurement', () => {
  it('labels operations for the history UI', () => {
    expect(operationLabel({ kind: 'add-walls', walls: [WALL_A] })).toBe('Draw wall');
    expect(operationLabel({ kind: 'remove-walls', wallIds: ['w-a', 'w-b'] })).toBe(
      'Delete 2 walls',
    );
    expect(operationLabel({ kind: 'note', label: 'share' })).toBe('share');
  });

  it('measures wall length in millimetres', () => {
    expect(wallLength(WALL_A)).toBe(3000);
    expect(wallLength({ id: 'w', start: worldPoint(0, 0), end: worldPoint(300, 400) })).toBe(500);
  });
});
