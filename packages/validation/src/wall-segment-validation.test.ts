import { describe, expect, it } from 'vitest';
import { worldPoint } from '@arq/geometry-2d';
import { hasErrors } from '@arq/operations';
import {
  MIN_WALL_SEGMENT_LENGTH_MM,
  validateWallSegment,
  validateWallSegments,
} from './wall-segment-validation';

const wall = (id: string, x1: number, y1: number, x2: number, y2: number) => ({
  id,
  start: worldPoint(x1, y1),
  end: worldPoint(x2, y2),
});

describe('validateWallSegment', () => {
  it('accepts an ordinary wall', () => {
    expect(validateWallSegment(wall('w1', 0, 0, 3000, 0))).toEqual([]);
  });

  it('rejects a zero-length wall as WALL_TOO_SHORT', () => {
    const messages = validateWallSegment(wall('w1', 100, 100, 100, 100));
    expect(messages).toHaveLength(1);
    expect(messages[0]?.code).toBe('WALL_TOO_SHORT');
    expect(messages[0]?.severity).toBe('error');
    expect(messages[0]?.explanation).toContain('No change was applied');
  });

  it('rejects a wall just under the minimum and accepts one at it', () => {
    expect(
      hasErrors(validateWallSegment(wall('w1', 0, 0, MIN_WALL_SEGMENT_LENGTH_MM / 2, 0))),
    ).toBe(true);
    expect(validateWallSegment(wall('w1', 0, 0, MIN_WALL_SEGMENT_LENGTH_MM, 0))).toEqual([]);
  });

  it('rejects non-finite coordinates before measuring length', () => {
    const messages = validateWallSegment(wall('w1', 0, 0, Number.NaN, 0));
    expect(messages[0]?.code).toBe('WALL_NON_FINITE_GEOMETRY');
  });
});

describe('validateWallSegments', () => {
  it('flags a duplicate of an existing wall as a warning, either direction', () => {
    const existing = [wall('old', 0, 0, 1000, 0)];
    const reversed = validateWallSegments([wall('new', 1000, 0, 0, 0)], existing);
    expect(reversed).toHaveLength(1);
    expect(reversed[0]?.code).toBe('WALL_DUPLICATE_GEOMETRY');
    expect(reversed[0]?.severity).toBe('warning');
  });

  it('flags duplicates inside the same batch', () => {
    const batch = [wall('a', 0, 0, 1000, 0), wall('b', 0, 0, 1000, 0)];
    expect(validateWallSegments(batch).map((m) => m.code)).toEqual(['WALL_DUPLICATE_GEOMETRY']);
  });

  it('accepts a clean batch against clean existing walls', () => {
    const existing = [wall('old', 0, 0, 1000, 0)];
    expect(validateWallSegments([wall('new', 0, 1000, 1000, 1000)], existing)).toEqual([]);
  });
});
