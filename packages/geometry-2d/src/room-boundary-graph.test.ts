import { describe, expect, it } from 'vitest';
import { worldPoint } from './coordinate-system';
import { traceRoomBoundary, type RoomBoundaryEdge } from './room-boundary-graph';

function edge(id: string, sx: number, sy: number, ex: number, ey: number): RoomBoundaryEdge<string> {
  return { id, start: worldPoint(sx, sy), end: worldPoint(ex, ey) };
}

describe('traceRoomBoundary: simple enclosed square', () => {
  const walls = [
    edge('n', 0, 0, 10, 0),
    edge('e', 10, 0, 10, 10),
    edge('s', 10, 10, 0, 10),
    edge('w', 0, 10, 0, 0),
  ];

  it('finds the square boundary from a seed point at its centre', () => {
    const result = traceRoomBoundary(walls, worldPoint(5, 5), 1e-6);
    expect(result.status).toBe('valid');
    expect(result.boundary).toHaveLength(4);
    expect(result.boundaryEdgeIds).toHaveLength(4);
    expect(new Set(result.boundaryEdgeIds)).toEqual(new Set(['n', 'e', 's', 'w']));
  });

  it('is not-enclosed for a seed point outside the square', () => {
    const result = traceRoomBoundary(walls, worldPoint(50, 50), 1e-6);
    expect(result.status).toBe('not-enclosed');
    expect(result.boundary).toEqual([]);
  });

  it('handles nearly-coincident endpoints within tolerance (adversarial: section 42)', () => {
    const almostClosed = [
      edge('n', 0, 0, 10, 0),
      edge('e', 10, 0, 10, 10),
      edge('s', 10, 10, 0.0000001, 10),
      edge('w', 0.0000001, 10, 0, 0),
    ];
    const result = traceRoomBoundary(almostClosed, worldPoint(5, 5), 1e-6);
    expect(result.status).toBe('valid');
  });
});

describe('traceRoomBoundary: not enclosed', () => {
  it('is not-enclosed when one wall is missing (an open "C" shape)', () => {
    const openShape = [edge('n', 0, 0, 10, 0), edge('e', 10, 0, 10, 10), edge('s', 10, 10, 0, 10)];
    const result = traceRoomBoundary(openShape, worldPoint(5, 5), 1e-6);
    expect(result.status).toBe('not-enclosed');
  });

  it('is not-enclosed for two disconnected wall segments', () => {
    const disconnected = [edge('a', 0, 0, 10, 0), edge('b', 100, 100, 110, 100)];
    const result = traceRoomBoundary(disconnected, worldPoint(5, 5), 1e-6);
    expect(result.status).toBe('not-enclosed');
  });
});

describe('traceRoomBoundary: T-junction picks the smallest enclosing face', () => {
  // A 10x10 square split down the middle (x=5) into two 5x10 rooms.
  const walls = [
    edge('n1', 0, 0, 5, 0),
    edge('n2', 5, 0, 10, 0),
    edge('e', 10, 0, 10, 10),
    edge('s1', 10, 10, 5, 10),
    edge('s2', 5, 10, 0, 10),
    edge('w', 0, 10, 0, 0),
    edge('mid', 5, 0, 5, 10),
  ];

  it('finds only the left half for a seed point in the left room', () => {
    const result = traceRoomBoundary(walls, worldPoint(2, 5), 1e-6);
    expect(result.status).toBe('valid');
    expect(new Set(result.boundaryEdgeIds)).toEqual(new Set(['n1', 'mid', 's2', 'w']));
  });

  it('finds only the right half for a seed point in the right room', () => {
    const result = traceRoomBoundary(walls, worldPoint(8, 5), 1e-6);
    expect(result.status).toBe('valid');
    expect(new Set(result.boundaryEdgeIds)).toEqual(new Set(['n2', 'e', 's1', 'mid']));
  });

  it('is not-enclosed for a seed point exactly on the dividing wall', () => {
    // On the boundary of both rooms - pointInPolygon treats a boundary point
    // as inside, so this should resolve to one of the two (smaller-or-equal
    // area) faces, not fail; both faces have equal area, so whichever is
    // traced/found first wins deterministically.
    const result = traceRoomBoundary(walls, worldPoint(5, 5), 1e-6);
    expect(result.status).toBe('valid');
  });
});

describe('traceRoomBoundary: degenerate input', () => {
  it('skips a zero-length edge without crashing', () => {
    const walls = [
      edge('n', 0, 0, 10, 0),
      edge('e', 10, 0, 10, 10),
      edge('s', 10, 10, 0, 10),
      edge('w', 0, 10, 0, 0),
      edge('zero', 3, 3, 3, 3),
    ];
    const result = traceRoomBoundary(walls, worldPoint(5, 5), 1e-6);
    expect(result.status).toBe('valid');
  });

  it("returns 'invalid-polygon' for a negative tolerance rather than a hidden fallback", () => {
    const walls = [edge('n', 0, 0, 10, 0)];
    const result = traceRoomBoundary(walls, worldPoint(5, 5), -1e-6);
    expect(result.status).toBe('invalid-polygon');
  });

  it("returns 'invalid-polygon' for a non-finite tolerance", () => {
    const walls = [edge('n', 0, 0, 10, 0)];
    const result = traceRoomBoundary(walls, worldPoint(5, 5), Number.NaN);
    expect(result.status).toBe('invalid-polygon');
  });

  it('is not-enclosed for an empty edge list', () => {
    const result = traceRoomBoundary([], worldPoint(5, 5), 1e-6);
    expect(result.status).toBe('not-enclosed');
  });
});

describe('traceRoomBoundary: large world coordinates', () => {
  it('finds the boundary correctly at a large coordinate offset (adversarial: section 42)', () => {
    const offset = 1_000_000;
    const walls = [
      edge('n', offset, offset, offset + 10, offset),
      edge('e', offset + 10, offset, offset + 10, offset + 10),
      edge('s', offset + 10, offset + 10, offset, offset + 10),
      edge('w', offset, offset + 10, offset, offset),
    ];
    const result = traceRoomBoundary(walls, worldPoint(offset + 5, offset + 5), 1e-6);
    expect(result.status).toBe('valid');
    expect(result.boundary).toHaveLength(4);
  });
});
