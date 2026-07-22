import { describe, expect, it } from 'vitest';
import { worldPoint } from './coordinate-system';
import { wallFaceLine, wallFaceOffsets } from './wall-face-line';

const horizontalWall = { start: worldPoint(0, 0), end: worldPoint(10, 0) };

describe('wallFaceOffsets', () => {
  it('splits thickness evenly for centre alignment', () => {
    expect(wallFaceOffsets(2, 'centre')).toEqual({ left: 1, right: 1 });
  });

  it('puts the entire thickness on the left for interior alignment', () => {
    expect(wallFaceOffsets(2, 'interior')).toEqual({ left: 2, right: 0 });
  });

  it('puts the entire thickness on the right for exterior alignment', () => {
    expect(wallFaceOffsets(2, 'exterior')).toEqual({ left: 0, right: 2 });
  });
});

describe('wallFaceLine', () => {
  it('returns the left face line offset +y for a horizontal wall (left = direction rotated +90)', () => {
    const line = wallFaceLine(horizontalWall, 2, 'centre', 'left', 1e-9)!;
    expect(line.start.y).toBeCloseTo(1, 9);
    expect(line.end.y).toBeCloseTo(1, 9);
  });

  it('returns the right face line offset -y for a horizontal wall', () => {
    const line = wallFaceLine(horizontalWall, 2, 'centre', 'right', 1e-9)!;
    expect(line.start.y).toBeCloseTo(-1, 9);
    expect(line.end.y).toBeCloseTo(-1, 9);
  });

  it('returns null for a zero-length centerline', () => {
    const zeroLength = { start: worldPoint(5, 5), end: worldPoint(5, 5) };
    expect(wallFaceLine(zeroLength, 2, 'centre', 'left', 1e-9)).toBeNull();
  });

  it('returns null for a non-positive thickness or invalid tolerance', () => {
    expect(wallFaceLine(horizontalWall, 0, 'centre', 'left', 1e-9)).toBeNull();
    expect(wallFaceLine(horizontalWall, 2, 'centre', 'left', -1)).toBeNull();
  });
});
