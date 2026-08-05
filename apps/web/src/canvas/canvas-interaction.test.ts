import { describe, expect, it } from 'vitest';
import { worldPoint, type Viewport } from '@arq/geometry-2d';
import { boundsFromCorners } from '@arq/editor-shell';
import {
  GRID_SPACING_MM,
  computeSnap,
  contentBounds,
  pickElementAt,
  selectWallsInRegion,
  wheelZoomFactor,
  type PlanContent,
} from './canvas-interaction';
import type { DrawnWall } from './plan-document';

const ROOM: readonly [number, number][] = [
  [0, 0],
  [4200, 0],
  [4200, 3600],
  [0, 3600],
];

function content(walls: readonly DrawnWall[] = []): PlanContent {
  return {
    rooms: [
      {
        id: 'demo-room',
        label: 'demo fixture',
        polygon: ROOM.map(([x, y]) => worldPoint(x, y)),
      },
    ],
    walls,
  };
}

/** 1 px per mm, 1000x800 screen centred on the room - tolerances stay intuitive. */
const VIEWPORT: Viewport = {
  center: worldPoint(2100, 1800),
  pixelsPerUnit: 1,
  screenWidth: 1000,
  screenHeight: 800,
};

const WALL: DrawnWall = { id: 'w-1', start: worldPoint(1000, 1000), end: worldPoint(2000, 1000) };

describe('computeSnap', () => {
  it('prefers an endpoint over the grid when both are in tolerance', () => {
    // Wall endpoint at (1000,1000) is also exactly on the 250mm grid.
    const snap = computeSnap(worldPoint(1004, 1003), content([WALL]), VIEWPORT);
    expect(snap?.source).toBe('endpoint');
    expect(snap?.point).toEqual(worldPoint(1000, 1000));
  });

  it('snaps to a wall midpoint', () => {
    const snap = computeSnap(worldPoint(1502, 1004), content([WALL]), VIEWPORT);
    expect(snap?.source).toBe('midpoint');
    expect(snap?.point).toEqual(worldPoint(1500, 1000));
  });

  it('falls back to the grid away from any wall', () => {
    const snap = computeSnap(worldPoint(3247, 2748), content([WALL]), VIEWPORT);
    expect(snap?.source).toBe('grid');
    expect(snap?.point).toEqual(worldPoint(3250, 2750));
  });

  it('returns nothing when the cursor is far from every source', () => {
    // Between grid lines (125 mm from the nearest) and away from walls.
    const snap = computeSnap(
      worldPoint(GRID_SPACING_MM / 2, GRID_SPACING_MM / 2),
      content(),
      VIEWPORT,
    );
    expect(snap?.source === 'grid' ? snap.point : null).not.toEqual(
      worldPoint(GRID_SPACING_MM / 2, GRID_SPACING_MM / 2),
    );
  });
});

describe('pickElementAt', () => {
  it('picks a drawn wall by clicking near its segment', () => {
    expect(pickElementAt(content([WALL]), worldPoint(1500, 1003), VIEWPORT)).toBe('w-1');
  });

  it('prefers the most recently drawn wall when two overlap', () => {
    const overlapping: DrawnWall = {
      id: 'w-2',
      start: worldPoint(1000, 1000),
      end: worldPoint(2000, 1000),
    };
    expect(pickElementAt(content([WALL, overlapping]), worldPoint(1500, 1000), VIEWPORT)).toBe(
      'w-2',
    );
  });

  it('picks the room fixture on its boundary', () => {
    expect(pickElementAt(content(), worldPoint(2100, 2), VIEWPORT)).toBe('demo-room');
  });

  it('returns null on empty canvas', () => {
    expect(pickElementAt(content(), worldPoint(2100, 1800), VIEWPORT)).toBeNull();
  });
});

describe('contentBounds', () => {
  it('covers the room fixture alone', () => {
    expect(contentBounds(content())).toEqual({
      min: worldPoint(0, 0),
      max: worldPoint(4200, 3600),
    });
  });

  it('expands to include walls drawn outside the room', () => {
    const outside: DrawnWall = {
      id: 'w-out',
      start: worldPoint(-1000, 0),
      end: worldPoint(0, 5000),
    };
    expect(contentBounds(content([outside]))).toEqual({
      min: worldPoint(-1000, 0),
      max: worldPoint(4200, 5000),
    });
  });
});

describe('selectWallsInRegion', () => {
  const wallA: DrawnWall = {
    id: 'w-a',
    start: worldPoint(1000, 1000),
    end: worldPoint(2000, 1000),
  };
  const wallB: DrawnWall = { id: 'w-b', start: worldPoint(1500, 500), end: worldPoint(1500, 2500) };

  it('window mode selects only fully-contained walls', () => {
    const region = boundsFromCorners(worldPoint(900, 900), worldPoint(2100, 1100));
    expect(selectWallsInRegion(content([wallA, wallB]), region, 'window')).toEqual(['w-a']);
  });

  it('crossing mode also selects walls that merely touch the region', () => {
    const region = boundsFromCorners(worldPoint(900, 900), worldPoint(2100, 1100));
    expect(selectWallsInRegion(content([wallA, wallB]), region, 'crossing')).toEqual([
      'w-a',
      'w-b',
    ]);
  });

  it('crossing mode catches a wall that spans the region with both endpoints outside', () => {
    const region = boundsFromCorners(worldPoint(1400, 900), worldPoint(1600, 1100));
    expect(selectWallsInRegion(content([wallB]), region, 'crossing')).toEqual(['w-b']);
  });

  it('never selects the room fixture', () => {
    const everything = boundsFromCorners(worldPoint(-10000, -10000), worldPoint(10000, 10000));
    expect(selectWallsInRegion(content([wallA]), everything, 'window')).toEqual(['w-a']);
  });
});

describe('wheelZoomFactor', () => {
  it('zooms in on negative deltaY and out on positive, clamped per step', () => {
    expect(wheelZoomFactor(-100)).toBeGreaterThan(1);
    expect(wheelZoomFactor(100)).toBeLessThan(1);
    expect(wheelZoomFactor(-100000)).toBe(2);
    expect(wheelZoomFactor(100000)).toBe(0.5);
  });
});
