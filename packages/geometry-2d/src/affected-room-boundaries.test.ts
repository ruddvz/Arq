import { describe, expect, it } from 'vitest';
import { worldPoint } from './coordinate-system';
import type { RoomBoundaryEdge } from './room-boundary-graph';
import {
  edgesForRetrace,
  extentOfEdge,
  extentOfPoints,
  extentsOverlap,
  retraceSearchExtent,
  roomsAffectedByEdgeChanges,
  unionExtents,
  type BoundaryEdgeChange,
  type TracedRoom,
} from './affected-room-boundaries';

/** A 5m x 5m room at the origin, traced from four walls. */
const ROOM_A: TracedRoom<string, string> = {
  roomId: 'room-a',
  seedPoint: worldPoint(2500, 2500),
  boundaryEdgeIds: ['w-n', 'w-e', 'w-s', 'w-w'],
  boundary: [worldPoint(0, 0), worldPoint(5000, 0), worldPoint(5000, 5000), worldPoint(0, 5000)],
};

/** A second room 50m away, sharing no walls. */
const ROOM_B: TracedRoom<string, string> = {
  roomId: 'room-b',
  seedPoint: worldPoint(52_500, 2500),
  boundaryEdgeIds: ['x-n', 'x-e', 'x-s', 'x-w'],
  boundary: [
    worldPoint(50_000, 0),
    worldPoint(55_000, 0),
    worldPoint(55_000, 5000),
    worldPoint(50_000, 5000),
  ],
};

function change(
  edgeId: string,
  kind: BoundaryEdgeChange<string>['kind'],
  minX: number,
  minY: number,
  maxX: number,
  maxY: number,
): BoundaryEdgeChange<string> {
  return { edgeId, kind, extent: { minX, minY, maxX, maxY } };
}

describe('roomsAffectedByEdgeChanges', () => {
  it('returns nothing when nothing changed', () => {
    expect(roomsAffectedByEdgeChanges([ROOM_A, ROOM_B], [], 1)).toEqual([]);
  });

  it('includes a room built on the edge that changed', () => {
    const affected = roomsAffectedByEdgeChanges(
      [ROOM_A, ROOM_B],
      [change('w-n', 'moved', 0, 0, 5000, 0)],
      1,
    );

    expect(affected).toEqual([{ roomId: 'room-a', reason: 'boundary-edge-changed' }]);
  });

  it('includes a room a brand new wall was drawn inside, which cannot reference it yet', () => {
    // The wall that splits a room in two is not on either room's edge list -
    // it did not exist when they were traced.
    const affected = roomsAffectedByEdgeChanges(
      [ROOM_A, ROOM_B],
      [change('w-new', 'added', 2500, 0, 2500, 5000)],
      1,
    );

    expect(affected).toEqual([{ roomId: 'room-a', reason: 'change-within-extent' }]);
  });

  it('excludes a room the change comes nowhere near', () => {
    // This is the bound doing its job: a wall drawn in one corner of a site
    // must not force every room in it to retrace.
    const affected = roomsAffectedByEdgeChanges(
      [ROOM_A, ROOM_B],
      [change('w-new', 'added', 1000, 1000, 2000, 2000)],
      1,
    );

    expect(affected.map((entry) => entry.roomId)).toEqual(['room-a']);
  });

  it('includes both rooms when a wall moves out of one and into the other', () => {
    const affected = roomsAffectedByEdgeChanges(
      [ROOM_A, ROOM_B],
      [change('w-e', 'moved', 4000, 0, 51_000, 5000)],
      1,
    );

    expect(affected.map((entry) => entry.roomId)).toEqual(['room-a', 'room-b']);
  });

  it('includes a room whose wall was removed', () => {
    const affected = roomsAffectedByEdgeChanges(
      [ROOM_A],
      [change('w-s', 'removed', 0, 0, 5000, 0)],
      1,
    );

    expect(affected).toEqual([{ roomId: 'room-a', reason: 'boundary-edge-changed' }]);
  });

  it('always includes a room that has never traced, since it has no evidence to exclude it by', () => {
    const untraced: TracedRoom<string, string> = {
      roomId: 'room-c',
      seedPoint: worldPoint(-9000, -9000),
      boundaryEdgeIds: [],
      boundary: [],
    };

    const affected = roomsAffectedByEdgeChanges(
      [untraced],
      [change('w-new', 'added', 0, 0, 1, 1)],
      1,
    );

    expect(affected).toEqual([{ roomId: 'room-c', reason: 'never-traced' }]);
  });

  it('counts a change that lands just outside a boundary, within the margin', () => {
    // The margin has to match the trace's own tolerance, or this bound and the
    // thing it bounds disagree about what joins to what.
    const justOutside = change('w-new', 'added', 5000.5, 2000, 6000, 2000);

    expect(roomsAffectedByEdgeChanges([ROOM_A], [justOutside], 0).map((e) => e.roomId)).toEqual([]);
    expect(roomsAffectedByEdgeChanges([ROOM_A], [justOutside], 1).map((e) => e.roomId)).toEqual([
      'room-a',
    ]);
  });
});

describe('extentOfPoints', () => {
  it('bounds a polygon', () => {
    expect(extentOfPoints(ROOM_A.boundary)).toEqual({
      minX: 0,
      minY: 0,
      maxX: 5000,
      maxY: 5000,
    });
  });

  it('returns null for no points rather than an empty box at the origin', () => {
    expect(extentOfPoints([])).toBeNull();
  });
});

describe('extentOfEdge', () => {
  it('bounds a segment regardless of its direction', () => {
    const edge: RoomBoundaryEdge<string> = {
      id: 'e',
      start: worldPoint(5000, 5000),
      end: worldPoint(0, 0),
    };

    expect(extentOfEdge(edge)).toEqual({ minX: 0, minY: 0, maxX: 5000, maxY: 5000 });
  });
});

describe('extentsOverlap', () => {
  it('treats touching extents as overlapping', () => {
    const a = { minX: 0, minY: 0, maxX: 10, maxY: 10 };
    const b = { minX: 10, minY: 0, maxX: 20, maxY: 10 };

    expect(extentsOverlap(a, b, 0)).toBe(true);
  });

  it('separates extents beyond the margin', () => {
    const a = { minX: 0, minY: 0, maxX: 10, maxY: 10 };
    const b = { minX: 12, minY: 0, maxX: 20, maxY: 10 };

    expect(extentsOverlap(a, b, 1)).toBe(false);
    expect(extentsOverlap(a, b, 2)).toBe(true);
  });
});

describe('edgesForRetrace', () => {
  it('narrows the edges a retrace walks to those that can reach the room', () => {
    const edges: readonly RoomBoundaryEdge<string>[] = [
      { id: 'near', start: worldPoint(0, 0), end: worldPoint(5000, 0) },
      { id: 'far', start: worldPoint(90_000, 0), end: worldPoint(95_000, 0) },
    ];

    const kept = edgesForRetrace(edges, { minX: 0, minY: 0, maxX: 5000, maxY: 5000 }, 1);

    expect(kept.map((edge) => edge.id)).toEqual(['near']);
  });
});

describe('unionExtents', () => {
  it('returns the second extent when there is no first', () => {
    const b = { minX: 1, minY: 2, maxX: 3, maxY: 4 };

    expect(unionExtents(null, b)).toBe(b);
  });

  it('covers both', () => {
    expect(
      unionExtents({ minX: 0, minY: 0, maxX: 1, maxY: 1 }, { minX: 5, minY: -5, maxX: 6, maxY: 0 }),
    ).toEqual({ minX: 0, minY: -5, maxX: 6, maxY: 1 });
  });
});

describe('retraceSearchExtent', () => {
  it('grows the room extent by the change that opened it up', () => {
    // A removed perimeter wall opens the room into space its old extent never
    // covered, so retracing against the old extent alone would find nothing.
    const extent = retraceSearchExtent(
      ROOM_A,
      [change('w-e', 'removed', 5000, 0, 5000, 5000), change('w-far', 'added', 9000, 0, 9500, 500)],
      1,
    );

    expect(extent).toEqual({ minX: 0, minY: 0, maxX: 5000, maxY: 5000 });
  });

  it('includes a nearby change that overlaps the room', () => {
    const extent = retraceSearchExtent(ROOM_A, [change('w-new', 'added', 4000, 0, 7000, 100)], 1);

    expect(extent).toEqual({ minX: 0, minY: 0, maxX: 7000, maxY: 5000 });
  });

  it('ignores a change that touches neither the room nor its edges', () => {
    const extent = retraceSearchExtent(
      ROOM_A,
      [change('w-far', 'added', 90_000, 0, 95_000, 10)],
      1,
    );

    expect(extent).toEqual({ minX: 0, minY: 0, maxX: 5000, maxY: 5000 });
  });

  it('is null for a room that has never traced and has no changed edges', () => {
    const untraced: TracedRoom<string, string> = {
      roomId: 'room-c',
      seedPoint: worldPoint(0, 0),
      boundaryEdgeIds: [],
      boundary: [],
    };

    expect(retraceSearchExtent(untraced, [change('w', 'added', 0, 0, 1, 1)], 1)).toBeNull();
  });
});
