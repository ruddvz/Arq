import { describe, expect, it } from 'vitest';
import { worldPoint, type Segment } from '@arq/geometry-2d';
import { openingInfill, openingInfillsForWall, type OpeningInfillInput } from './opening-infill';

/**
 * A 6m wall running east along y = 0, 250mm thick - so along the wall is +x, the
 * left-hand normal is +y, and every expected coordinate below can be worked out
 * by hand.
 */
const EAST: Segment = { start: worldPoint(0, 0), end: worldPoint(6000, 0) };
const THICKNESS = 250;

const DOOR: OpeningInfillInput = {
  id: 'op-1',
  kind: 'door',
  offsetFromWallStart: 1000,
  width: 900,
  sillHeight: 0,
  height: 2100,
};

const WINDOW: OpeningInfillInput = {
  id: 'op-2',
  kind: 'window',
  offsetFromWallStart: 3000,
  width: 1200,
  sillHeight: 900,
  height: 1200,
};

/** The extent of an outline in each axis, which is what the shape assertions read. */
function extent(outline: readonly { readonly x: number; readonly y: number }[]): {
  readonly width: number;
  readonly depth: number;
} {
  const xs = outline.map((point) => point.x);
  const ys = outline.map((point) => point.y);
  return {
    width: Math.max(...xs) - Math.min(...xs),
    depth: Math.max(...ys) - Math.min(...ys),
  };
}

describe('openingInfill', () => {
  it('stands a door leaf from the sill to the head', () => {
    const infill = openingInfill(EAST, THICKNESS, DOOR, 0);
    expect(infill?.part).toBe('leaf');
    expect(infill?.baseElevation).toBe(0);
    expect(infill?.height).toBe(2100);
  });

  it('gives the leaf its own width and a leaf thickness, not the wall thickness', () => {
    // Swung a quarter turn, the leaf runs across the wall: 900 deep and 40 wide.
    // Extruding the reveal instead would fill the doorway with a 250mm slab,
    // which is a blocked door rather than an open one.
    const infill = openingInfill(EAST, THICKNESS, DOOR, 0);
    const size = extent(infill!.outline);
    expect(size.depth).toBeCloseTo(900, 6);
    expect(size.width).toBeCloseTo(40, 6);
  });

  it('hangs the leaf at the swing angle the plan draws it at', () => {
    // Closed, the leaf lies in its own opening: 900 along the wall and 40 across
    // it - the transpose of the quarter-turn case above. The two views read one
    // `doorLeafPlacement`, so this is the same angle the plan's leaf line uses.
    const infill = openingInfill(EAST, THICKNESS, { ...DOOR, swingAngle: 0 }, 0);
    const size = extent(infill!.outline);
    expect(size.width).toBeCloseTo(900, 6);
    expect(size.depth).toBeCloseTo(40, 6);
  });

  it('puts the leaf on the side the door opens to', () => {
    const left = openingInfill(EAST, THICKNESS, { ...DOOR, side: 'left' }, 0);
    const right = openingInfill(EAST, THICKNESS, { ...DOOR, side: 'right' }, 0);
    expect(Math.max(...left!.outline.map((point) => point.y))).toBeGreaterThan(0);
    expect(Math.min(...right!.outline.map((point) => point.y))).toBeLessThan(0);
  });

  it('glazes a window across its reveal, a third of the wall thick', () => {
    const infill = openingInfill(EAST, THICKNESS, WINDOW, 0);
    expect(infill?.part).toBe('pane');
    const size = extent(infill!.outline);
    expect(size.width).toBeCloseTo(1200, 6);
    // The same third the plan's pane band uses, so one piece of glass is
    // described the same way in both views.
    expect(size.depth).toBeCloseTo(THICKNESS / 3, 6);
  });

  it('lifts a window to its sill above the level datum', () => {
    const infill = openingInfill(EAST, THICKNESS, WINDOW, 3200);
    expect(infill?.baseElevation).toBe(4100);
    expect(infill?.height).toBe(1200);
  });

  it('spans the pane between the jambs and nowhere else', () => {
    const infill = openingInfill(EAST, THICKNESS, WINDOW, 0);
    const xs = infill!.outline.map((point) => point.x);
    expect(Math.min(...xs)).toBeCloseTo(3000, 6);
    expect(Math.max(...xs)).toBeCloseTo(4200, 6);
  });

  it('leaves a void empty, because that is what a void is', () => {
    expect(openingInfill(EAST, THICKNESS, { ...DOOR, kind: 'void' }, 0)).toBeNull();
  });

  it('names the opening it fills, so picking a leaf selects the door', () => {
    const infill = openingInfill(EAST, THICKNESS, DOOR, 0);
    expect(infill?.openingId).toBe('op-1');
    expect(infill?.id).toBe('op-1-leaf');
  });

  it('refuses a degenerate wall, thickness or opening', () => {
    const degenerate: Segment = { start: worldPoint(5, 5), end: worldPoint(5, 5) };
    expect(openingInfill(degenerate, THICKNESS, DOOR, 0)).toBeNull();
    expect(openingInfill(degenerate, THICKNESS, WINDOW, 0)).toBeNull();
    expect(openingInfill(EAST, 0, WINDOW, 0)).toBeNull();
    expect(openingInfill(EAST, THICKNESS, { ...WINDOW, width: 0 }, 0)).toBeNull();
    expect(openingInfill(EAST, THICKNESS, { ...DOOR, height: 0 }, 0)).toBeNull();
  });

  it('refuses non-finite elevations (adversarial: non-finite values)', () => {
    expect(openingInfill(EAST, THICKNESS, { ...WINDOW, sillHeight: Number.NaN }, 0)).toBeNull();
    expect(openingInfill(EAST, THICKNESS, WINDOW, Number.POSITIVE_INFINITY)).toBeNull();
  });
});

describe('openingInfillsForWall', () => {
  it('fills every opening a wall hosts', () => {
    const infills = openingInfillsForWall(EAST, THICKNESS, [DOOR, WINDOW], 0);
    expect(infills.map((infill) => infill.part)).toEqual(['leaf', 'pane']);
  });

  it('drops only the opening it cannot place, not the wall', () => {
    // One unplaceable opening should cost its own leaf. Dropping the whole wall
    // would take a storey's doors and windows out of the model over one bad
    // record, which is the failure the plan surface already refuses.
    const infills = openingInfillsForWall(
      EAST,
      THICKNESS,
      [DOOR, { ...WINDOW, width: Number.NaN }],
      0,
    );
    expect(infills).toHaveLength(1);
    expect(infills[0]?.openingId).toBe('op-1');
  });

  it('returns nothing for a wall with no openings', () => {
    expect(openingInfillsForWall(EAST, THICKNESS, [], 0)).toEqual([]);
  });
});
