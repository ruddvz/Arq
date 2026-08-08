import { describe, expect, it } from 'vitest';
import { parsePlacedContent } from './placed-content';

/**
 * The three sections that used to be dropped on open.
 *
 * The cases worth writing here are the ones where a wrong answer is invisible:
 * a rotation applied to the wrong centre still produces a rectangle, and a
 * degenerate footprint still produces an object. Both would draw as *something*
 * and be wrong, which is the failure mode this module exists to prevent.
 */

function furnishing(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'it-desk',
    levelId: 'level-ground',
    roomId: 'rm-study',
    kind: 'desk',
    bounds: { x1: 1000, y1: 2000, x2: 3000, y2: 2600 },
    height: 750,
    rotationDegrees: 0,
    material: 'wood',
    ...overrides,
  };
}

describe('parsePlacedContent - furnishings', () => {
  it('reads an unrotated item as its own rectangle, corner for corner', () => {
    const result = parsePlacedContent({ furnishings: [furnishing()] });
    expect(result.status).toBe('parsed');
    if (result.status !== 'parsed') return;
    const [item] = result.content.furnishings;
    expect(item?.footprint).toEqual([
      { x: 1000, y: 2000 },
      { x: 3000, y: 2000 },
      { x: 3000, y: 2600 },
      { x: 1000, y: 2600 },
    ]);
    expect(item?.heightMillimetres).toBe(750);
    expect(item?.roomId).toBe('rm-study');
  });

  /**
   * The check that matters for an unrotated item, and the reason zero is
   * special-cased rather than run through cos/sin: a wall-anchored cabinet that
   * lands a floating-point hair off the wall it is anchored to fails a
   * clearance check for a reason that has nothing to do with the building.
   */
  it('leaves an unrotated item on exact coordinates, not cos(0)-rounded ones', () => {
    const result = parsePlacedContent({ furnishings: [furnishing()] });
    if (result.status !== 'parsed') throw new Error(result.reason);
    for (const corner of result.content.furnishings[0]!.footprint) {
      expect(Number.isInteger(corner.x)).toBe(true);
      expect(Number.isInteger(corner.y)).toBe(true);
    }
  });

  it('turns a rotated item about its own centre, not about the origin', () => {
    const result = parsePlacedContent({
      furnishings: [furnishing({ rotationDegrees: 90 })],
    });
    if (result.status !== 'parsed') throw new Error(result.reason);
    const corners = result.content.furnishings[0]!.footprint;
    // Centre is unmoved: (2000, 2300).
    const centreX = corners.reduce((sum, point) => sum + point.x, 0) / corners.length;
    const centreY = corners.reduce((sum, point) => sum + point.y, 0) / corners.length;
    expect(centreX).toBeCloseTo(2000, 9);
    expect(centreY).toBeCloseTo(2300, 9);
    // A quarter turn swaps the extents: 2000 x 600 becomes 600 x 2000.
    const width = Math.max(...corners.map((p) => p.x)) - Math.min(...corners.map((p) => p.x));
    const height = Math.max(...corners.map((p) => p.y)) - Math.min(...corners.map((p) => p.y));
    expect(width).toBeCloseTo(600, 9);
    expect(height).toBeCloseTo(2000, 9);
  });

  it('keeps a rotated item’s area, so a rotation cannot quietly resize it', () => {
    const result = parsePlacedContent({ furnishings: [furnishing({ rotationDegrees: -15 })] });
    if (result.status !== 'parsed') throw new Error(result.reason);
    const corners = result.content.furnishings[0]!.footprint;
    let twiceArea = 0;
    for (let index = 0; index < corners.length; index += 1) {
      const a = corners[index]!;
      const b = corners[(index + 1) % corners.length]!;
      twiceArea += a.x * b.y - b.x * a.y;
    }
    expect(Math.abs(twiceArea) / 2).toBeCloseTo(2000 * 600, 6);
  });

  it('rejects a footprint with no area rather than drawing nothing at all', () => {
    const result = parsePlacedContent({
      furnishings: [furnishing({ bounds: { x1: 1000, y1: 2000, x2: 1000, y2: 2600 } })],
    });
    expect(result.status).toBe('rejected');
    if (result.status !== 'rejected') return;
    expect(result.reason).toContain('it-desk');
  });

  it('normalises a rectangle written right-to-left instead of inverting it', () => {
    const result = parsePlacedContent({
      furnishings: [furnishing({ bounds: { x1: 3000, y1: 2600, x2: 1000, y2: 2000 } })],
    });
    if (result.status !== 'parsed') throw new Error(result.reason);
    expect(result.content.furnishings[0]!.footprint[0]).toEqual({ x: 1000, y: 2000 });
  });

  it('rejects an item with no usable height, which 3D would extrude to nothing', () => {
    const result = parsePlacedContent({ furnishings: [furnishing({ height: 0 })] });
    expect(result.status).toBe('rejected');
  });

  it('accepts an item the file assigns to no room', () => {
    const result = parsePlacedContent({ furnishings: [furnishing({ roomId: null })] });
    if (result.status !== 'parsed') throw new Error(result.reason);
    expect(result.content.furnishings[0]!.roomId).toBeNull();
  });
});

describe('parsePlacedContent - slabs', () => {
  const slab = {
    id: 'slab-ground',
    levelId: 'level-ground',
    outer: [0, 0, 18000, 16000],
    thickness: 180,
    voids: [[6000, 5000, 12000, 11000]],
  };

  it('reads the four-number array form the file uses', () => {
    const result = parsePlacedContent({ slabs: [slab] });
    if (result.status !== 'parsed') throw new Error(result.reason);
    const [plate] = result.content.slabs;
    expect(plate?.outline).toHaveLength(4);
    expect(plate?.outline[2]).toEqual({ x: 18000, y: 16000 });
    expect(plate?.thicknessMillimetres).toBe(180);
  });

  /** A hole a person can fall through is the one part of a plate that must not go missing. */
  it('keeps every void as its own ring', () => {
    const result = parsePlacedContent({
      slabs: [
        {
          ...slab,
          voids: [
            [6000, 5000, 12000, 11000],
            [14000, 300, 17700, 5000],
          ],
        },
      ],
    });
    if (result.status !== 'parsed') throw new Error(result.reason);
    expect(result.content.slabs[0]!.voids).toHaveLength(2);
    expect(result.content.slabs[0]!.voids[1]![0]).toEqual({ x: 14000, y: 300 });
  });

  it('rejects a malformed void rather than dropping the hole silently', () => {
    const result = parsePlacedContent({ slabs: [{ ...slab, voids: [[6000, 5000, 6000]] }] });
    expect(result.status).toBe('rejected');
    if (result.status !== 'rejected') return;
    expect(result.reason).toContain('void 0');
  });

  it('accepts a plate with no voids at all', () => {
    const result = parsePlacedContent({ slabs: [{ ...slab, voids: [] }] });
    if (result.status !== 'parsed') throw new Error(result.reason);
    expect(result.content.slabs[0]!.voids).toEqual([]);
  });
});

describe('parsePlacedContent - stairs', () => {
  const stair = {
    id: 'stair-main',
    flightDefinitions: [
      {
        id: 'flight-lower',
        x1: 16400,
        x2: 17500,
        yStart: 500,
        yEnd: 3020,
        startZ: 0,
        endZ: 1684.2105263157894,
        riserCount: 10,
        treadCount: 9,
      },
    ],
    landingDefinitions: [
      { id: 'landing-mid', x1: 14200, x2: 17500, y1: 3020, y2: 4220, z: 1684.2105263157894 },
    ],
  };

  it('keeps both flights and both landings of a dogleg', () => {
    const result = parsePlacedContent({ stairs: [stair] });
    if (result.status !== 'parsed') throw new Error(result.reason);
    expect(result.content.stairs[0]!.flights).toHaveLength(1);
    expect(result.content.stairs[0]!.landings).toHaveLength(1);
  });

  /**
   * The walking line runs up the middle of the flight, from the bottom riser to
   * the top. Taken from an edge instead, the direction arrow would run along a
   * stringer and read as a handrail.
   */
  it('runs the walking line up the centre of the flight, bottom to top', () => {
    const result = parsePlacedContent({ stairs: [stair] });
    if (result.status !== 'parsed') throw new Error(result.reason);
    const [flight] = result.content.stairs[0]!.flights;
    expect(flight?.start).toEqual({ x: 16950, y: 500 });
    expect(flight?.end).toEqual({ x: 16950, y: 3020 });
  });

  it('keeps the absolute rise, so a mid-landing is not attributed to a level', () => {
    const result = parsePlacedContent({ stairs: [stair] });
    if (result.status !== 'parsed') throw new Error(result.reason);
    const [flight] = result.content.stairs[0]!.flights;
    expect(flight?.baseElevation).toBe(0);
    expect(flight?.topElevation).toBeCloseTo(1684.21, 2);
    expect(result.content.stairs[0]!.landings[0]!.elevation).toBeCloseTo(1684.21, 2);
  });

  it('reads a flight running the other way without inverting its footprint', () => {
    const descending = {
      ...stair,
      flightDefinitions: [{ ...stair.flightDefinitions[0], yStart: 4220, yEnd: 1980 }],
    };
    const result = parsePlacedContent({ stairs: [descending] });
    if (result.status !== 'parsed') throw new Error(result.reason);
    const [flight] = result.content.stairs[0]!.flights;
    // The footprint is normalised; the walking line keeps the stated direction.
    expect(flight?.footprint[0]).toEqual({ x: 16400, y: 1980 });
    expect(flight?.start.y).toBe(4220);
    expect(flight?.end.y).toBe(1980);
  });

  it('rejects a stair with neither a flight nor a landing', () => {
    const result = parsePlacedContent({
      stairs: [{ id: 'stair-empty', flightDefinitions: [], landingDefinitions: [] }],
    });
    expect(result.status).toBe('rejected');
  });
});

describe('parsePlacedContent - absence', () => {
  /**
   * A project this build wrote carries none of these sections. Requiring them
   * would refuse the product's own files, so absence is not an error - but a
   * section that is present and malformed is, because that is a file claiming
   * to contain furniture and failing to say where any of it is.
   */
  it('reads a model with none of the three sections as empty, not as a failure', () => {
    const result = parsePlacedContent({ projectName: 'Untitled', walls: [] });
    if (result.status !== 'parsed') throw new Error(result.reason);
    expect(result.content).toEqual({ furnishings: [], slabs: [], stairs: [] });
  });

  it('ignores a section that is present but not a list', () => {
    const result = parsePlacedContent({ furnishings: 'lots' });
    if (result.status !== 'parsed') throw new Error(result.reason);
    expect(result.content.furnishings).toEqual([]);
  });
});
