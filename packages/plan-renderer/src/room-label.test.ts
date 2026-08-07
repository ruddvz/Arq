import { describe, expect, it } from 'vitest';
import { worldPoint, type WorldPoint } from '@arq/geometry-2d';
import {
  buildRoomLabelPrimitive,
  polygonCentroid,
  roomLabelAnchors,
  roomLabelAreaLine,
  roomLabelFits,
  roomLabelNameLine,
  roomLabelText,
  type RoomLabelSource,
} from './room-label';

const source: RoomLabelSource<string> = {
  elementId: 'room-1',
  seedPoint: worldPoint(1200, 800),
  name: 'Kitchen',
  areaSquareMetres: 12.345,
};

describe('roomLabelNameLine', () => {
  it('is just the name when there is no room number', () => {
    expect(roomLabelNameLine(source)).toBe('Kitchen');
  });

  it('prefixes the number when present', () => {
    expect(roomLabelNameLine({ ...source, number: '101' })).toBe('101 Kitchen');
  });
});

describe('roomLabelAreaLine', () => {
  it('formats the area to one decimal place with an m² suffix', () => {
    expect(roomLabelAreaLine(source)).toBe('12.3 m²');
  });

  it('rounds up when the second decimal is 5 or more', () => {
    expect(roomLabelAreaLine({ ...source, areaSquareMetres: 9.96 })).toBe('10.0 m²');
  });
});

describe('roomLabelText', () => {
  it('combines the name line and area line, separated by a newline', () => {
    expect(roomLabelText(source)).toBe('Kitchen\n12.3 m²');
  });

  it('includes the room number when present', () => {
    expect(roomLabelText({ ...source, number: '101' })).toBe('101 Kitchen\n12.3 m²');
  });
});

describe('buildRoomLabelPrimitive', () => {
  it('anchors the label at the room seedPoint and carries the given styleToken', () => {
    const primitive = buildRoomLabelPrimitive(source, 'default');
    expect(primitive).toEqual({
      kind: 'text',
      elementId: 'room-1',
      anchor: worldPoint(1200, 800),
      text: 'Kitchen\n12.3 m²',
      styleToken: 'default',
    });
  });

  it('carries whichever styleToken the caller resolved (e.g. selected-primary)', () => {
    const primitive = buildRoomLabelPrimitive(source, 'selected-primary');
    expect(primitive.styleToken).toBe('selected-primary');
  });
});

describe('roomLabelFits', () => {
  /** A rectangular room, centred on the origin, in millimetres. */
  function rectRoom(width: number, height: number): readonly WorldPoint[] {
    return [
      worldPoint(-width / 2, -height / 2),
      worldPoint(width / 2, -height / 2),
      worldPoint(width / 2, height / 2),
      worldPoint(-width / 2, height / 2),
    ];
  }

  const CENTRE = worldPoint(0, 0);

  it('draws a label the room has room for', () => {
    expect(
      roomLabelFits({
        polygon: rectRoom(4000, 3000),
        anchor: CENTRE,
        labelWidth: 1200,
        labelHeight: 480,
        wallInset: 100,
      }),
    ).toBe(true);
  });

  it('suppresses a label that only just fits, because only just reads as crossing the wall', () => {
    // 2000 wide in a 2200-wide room clears by 100 a side and looks wedged.
    expect(
      roomLabelFits({
        polygon: rectRoom(2200, 4000),
        anchor: CENTRE,
        labelWidth: 2000,
        labelHeight: 400,
        wallInset: 0,
      }),
    ).toBe(false);
    // A quarter of the label's own width of clear space is the point where it
    // reads as being in the room rather than filling it.
    expect(
      roomLabelFits({
        polygon: rectRoom(2700, 4000),
        anchor: CENTRE,
        labelWidth: 2000,
        labelHeight: 400,
        wallInset: 0,
      }),
    ).toBe(true);
  });

  it('refuses the exactly-touching case rather than picking a side of it', () => {
    // 2000 x 1.25 is 2500, so in a 2500-wide room the clearance box lands
    // exactly on the boundary. Containment here is strict: a box that reaches
    // the line is not inside it. The alternative is a label that is provably
    // touching the wall it is meant to be clear of, and the room this refuses
    // is one millimetre from being refused anyway.
    expect(
      roomLabelFits({
        polygon: rectRoom(2500, 4000),
        anchor: CENTRE,
        labelWidth: 2000,
        labelHeight: 400,
        wallInset: 0,
      }),
    ).toBe(false);
  });

  it('suppresses a label wider than the room it names', () => {
    // The golden fixture's galleries on a phone: a few hundred millimetres of
    // room and a label wider than all of it. Three overlapped into an
    // unreadable smear that also hid the walls underneath.
    expect(
      roomLabelFits({
        polygon: rectRoom(800, 4000),
        anchor: CENTRE,
        labelWidth: 2400,
        labelHeight: 480,
        wallInset: 0,
      }),
    ).toBe(false);
  });

  it('suppresses a label taller than the room, not only a wider one', () => {
    expect(
      roomLabelFits({
        polygon: rectRoom(6000, 400),
        anchor: CENTRE,
        labelWidth: 800,
        labelHeight: 480,
        wallInset: 0,
      }),
    ).toBe(false);
  });

  it('keeps clear space, so a label never reads as touching the walls beside it', () => {
    // Exactly as wide as the room is not a fit: it would sit hard against both
    // walls with no gap at all.
    expect(
      roomLabelFits({
        polygon: rectRoom(2000, 2000),
        anchor: CENTRE,
        labelWidth: 2000,
        labelHeight: 400,
        wallInset: 0,
      }),
    ).toBe(false);
  });

  it('measures the floor, not the ring, so half a wall is never counted as room', () => {
    const room = rectRoom(1600, 1600);
    const label = { polygon: room, anchor: CENTRE, labelWidth: 1200, labelHeight: 400 };
    // The ring runs to the wall centrelines. Ignoring that, the label clears:
    // 1200 and a quarter is 1500, inside 1600.
    expect(roomLabelFits({ ...label, wallInset: 0 })).toBe(true);
    // A 250mm wall puts 125mm of poché inside each edge, and it no longer does.
    expect(roomLabelFits({ ...label, wallInset: 125 })).toBe(false);
  });

  describe('a room that is not a centred rectangle', () => {
    /*
     * The bounding-box test this replaced was wrong for exactly these, and
     * wrong in the direction that shows on screen: a label is drawn centred on
     * the room's centroid, and for an L the centroid is not the bounding box's
     * centre, so a label that cleared the box arithmetically still ran out over
     * the poche. "Linen" and "Inner hall" were both doing that on the phone.
     */
    const L_SHAPE: readonly WorldPoint[] = [
      worldPoint(0, 0),
      worldPoint(6000, 0),
      worldPoint(6000, 1000),
      worldPoint(1000, 1000),
      worldPoint(1000, 6000),
      worldPoint(0, 6000),
    ];

    it('refuses a label that leaves the room through the notch', () => {
      // The centroid of this L sits near (1650, 1650) - inside the notch's
      // corner, where there is barely any floor. The bounding box is 6000
      // square and would have said yes to all of this.
      const centroid = worldPoint(1650, 1650);
      expect(
        roomLabelFits({
          polygon: L_SHAPE,
          anchor: centroid,
          labelWidth: 3000,
          labelHeight: 600,
          wallInset: 0,
        }),
      ).toBe(false);
    });

    it('draws a label placed in the arm that can hold it', () => {
      expect(
        roomLabelFits({
          polygon: L_SHAPE,
          anchor: worldPoint(3500, 500),
          labelWidth: 1500,
          labelHeight: 400,
          wallInset: 0,
        }),
      ).toBe(true);
    });

    it('refuses an anchor that is not in the room at all', () => {
      // The area centroid of a deep enough L falls outside it, and a label
      // drawn there names a room while sitting outside its walls.
      expect(
        roomLabelFits({
          polygon: L_SHAPE,
          anchor: worldPoint(4000, 4000),
          labelWidth: 200,
          labelHeight: 100,
          wallInset: 0,
        }),
      ).toBe(false);
    });
  });

  describe('linework the room boundary does not know about', () => {
    /*
     * The golden fixture's "Linen" is a 1750 x 1300 room with an interior wall
     * running through the middle of it - the boundary was calculated before
     * that wall existed - and its label was drawn with the wall struck through
     * the word. "Inner hall" and "Entry foyer" had the same failure from a
     * door's swing arc, which sweeps into a room by design and is part of no
     * room's boundary at all. Containment in the ring cannot see either.
     */
    const ROOM = rectRoom(6000, 6000);

    it('refuses a label a wall would be drawn across', () => {
      const wall = {
        start: worldPoint(500, -3000),
        end: worldPoint(500, 3000),
        clearance: 62.5,
      };
      const query = {
        polygon: ROOM,
        anchor: CENTRE,
        labelWidth: 1500,
        labelHeight: 500,
        wallInset: 0,
      };
      // Nothing about the room changed; only what is drawn on it.
      expect(roomLabelFits(query)).toBe(true);
      expect(roomLabelFits({ ...query, obstacles: [wall] })).toBe(false);
    });

    it('refuses a label a swing arc would sweep through', () => {
      // A polyline, as `swingPolyline` returns it, entering from a corner.
      const arc = [
        worldPoint(-3000, -3000),
        worldPoint(-1500, -2000),
        worldPoint(-400, -300),
        worldPoint(0, 400),
      ];
      const obstacles = arc.slice(1).map((point, index) => ({
        start: arc[index]!,
        end: point,
        clearance: 0,
      }));
      expect(
        roomLabelFits({
          polygon: ROOM,
          anchor: CENTRE,
          labelWidth: 1500,
          labelHeight: 500,
          wallInset: 0,
          obstacles,
        }),
      ).toBe(false);
    });

    it('lets a label stand beside linework it clears', () => {
      expect(
        roomLabelFits({
          polygon: ROOM,
          anchor: CENTRE,
          labelWidth: 1000,
          labelHeight: 400,
          wallInset: 0,
          obstacles: [
            { start: worldPoint(2500, -3000), end: worldPoint(2500, 3000), clearance: 62.5 },
            { start: worldPoint(-3000, 2000), end: worldPoint(3000, 2000), clearance: 125 },
          ],
        }),
      ).toBe(true);
    });

    it('counts a wall that stops inside the label, not only one that crosses it', () => {
      // A pier ending mid-word crosses no edge of the label's box on its way
      // out, because it never leaves. Endpoints are asked separately for this.
      expect(
        roomLabelFits({
          polygon: ROOM,
          anchor: CENTRE,
          labelWidth: 2000,
          labelHeight: 600,
          wallInset: 0,
          obstacles: [{ start: worldPoint(0, 0), end: worldPoint(200, 100), clearance: 0 }],
        }),
      ).toBe(false);
    });

    it('holds a thin partition at its own distance, not the thickest wall on the level', () => {
      const query = {
        polygon: ROOM,
        anchor: CENTRE,
        labelWidth: 1000,
        labelHeight: 400,
        wallInset: 0,
      };
      const at = (x: number, clearance: number) => ({
        start: worldPoint(x, -3000),
        end: worldPoint(x, 3000),
        clearance,
      });
      // The label's box reaches x = 625. A 125mm partition centred at x = 700
      // has its face at 637.5 and clears it; a 250mm exterior wall on the same
      // centreline has its face at 575 and does not.
      expect(roomLabelFits({ ...query, obstacles: [at(700, 62.5)] })).toBe(true);
      expect(roomLabelFits({ ...query, obstacles: [at(700, 125)] })).toBe(false);
    });

    it('refuses an obstacle it cannot measure rather than ignoring it', () => {
      expect(
        roomLabelFits({
          polygon: ROOM,
          anchor: CENTRE,
          labelWidth: 500,
          labelHeight: 200,
          wallInset: 0,
          obstacles: [
            { start: worldPoint(2900, -3000), end: worldPoint(2900, 3000), clearance: Number.NaN },
          ],
        }),
      ).toBe(false);
    });
  });

  it('refuses a measurement it cannot trust rather than drawing on a guess', () => {
    const room = rectRoom(8000, 8000);
    expect(
      roomLabelFits({
        polygon: room,
        anchor: CENTRE,
        labelWidth: Number.NaN,
        labelHeight: 400,
        wallInset: 0,
      }),
    ).toBe(false);
    expect(
      roomLabelFits({
        polygon: room,
        anchor: CENTRE,
        labelWidth: 0,
        labelHeight: 400,
        wallInset: 0,
      }),
    ).toBe(false);
    // Not a ring.
    expect(
      roomLabelFits({
        polygon: [worldPoint(0, 0), worldPoint(1000, 0)],
        anchor: CENTRE,
        labelWidth: 100,
        labelHeight: 100,
        wallInset: 0,
      }),
    ).toBe(false);
  });
});

describe('roomLabelAnchors', () => {
  function rect(x0: number, y0: number, x1: number, y1: number): readonly WorldPoint[] {
    return [worldPoint(x0, y0), worldPoint(x1, y0), worldPoint(x1, y1), worldPoint(x0, y1)];
  }

  it('offers the centre first, so a room whose middle is clear is labelled in its middle', () => {
    const room = rect(0, 0, 4000, 3000);
    const [first] = roomLabelAnchors(room);
    expect(first).toEqual(polygonCentroid(room));
  });

  it('offers positions further out, ordered by how far they are from the centre', () => {
    const room = rect(0, 0, 4000, 3000);
    const anchors = roomLabelAnchors(room);
    expect(anchors.length).toBeGreaterThan(1);
    const centre = polygonCentroid(room);
    const distances = anchors
      .slice(1)
      .map((point) => Math.hypot(point.x - centre.x, point.y - centre.y));
    // A label should only move as far as it has to.
    expect([...distances].sort((a, b) => a - b)).toEqual(distances);
  });

  it('never offers a position outside the room', () => {
    const lShape: readonly WorldPoint[] = [
      worldPoint(0, 0),
      worldPoint(6000, 0),
      worldPoint(6000, 1000),
      worldPoint(1000, 1000),
      worldPoint(1000, 6000),
      worldPoint(0, 6000),
    ];
    for (const anchor of roomLabelAnchors(lShape)) {
      // Ray-cast from each candidate, independently of the module's own test.
      let inside = false;
      for (let i = 0, j = lShape.length - 1; i < lShape.length; j = i, i += 1) {
        const vi = lShape[i]!;
        const vj = lShape[j]!;
        if (vi.y > anchor.y !== vj.y > anchor.y) {
          const x = ((vj.x - vi.x) * (anchor.y - vi.y)) / (vj.y - vi.y) + vi.x;
          if (anchor.x < x) inside = !inside;
        }
      }
      expect(inside).toBe(true);
    }
  });

  it('drops a centroid that falls outside its own room rather than offering it', () => {
    // A deep U: the area centroid sits in the gap between the arms.
    const u: readonly WorldPoint[] = [
      worldPoint(0, 0),
      worldPoint(6000, 0),
      worldPoint(6000, 6000),
      worldPoint(5000, 6000),
      worldPoint(5000, 1000),
      worldPoint(1000, 1000),
      worldPoint(1000, 6000),
      worldPoint(0, 6000),
    ];
    const centroid = polygonCentroid(u);
    const anchors = roomLabelAnchors(u);
    expect(anchors).not.toContainEqual(centroid);
    expect(anchors.length).toBeGreaterThan(0);
  });

  it('has nothing to offer for something that is not a ring', () => {
    expect(roomLabelAnchors([worldPoint(0, 0), worldPoint(1000, 0)])).toEqual([]);
  });

  it('finds a place for a label the centre cannot hold', () => {
    // A door swings through the middle of an otherwise roomy space. The centre
    // is unusable and the room is plainly large enough - which is exactly the
    // case a single-position placement gets wrong, and gets wrong by dropping
    // the name entirely.
    const room = rect(0, 0, 6000, 6000);
    const swing = { start: worldPoint(2600, 0), end: worldPoint(2600, 6000), clearance: 0 };
    const label = { labelWidth: 1400, labelHeight: 500, wallInset: 0 };
    const centre = polygonCentroid(room);
    expect(roomLabelFits({ polygon: room, anchor: centre, ...label, obstacles: [swing] })).toBe(
      false,
    );
    const placed = roomLabelAnchors(room).find((anchor) =>
      roomLabelFits({ polygon: room, anchor, ...label, obstacles: [swing] }),
    );
    expect(placed).toBeDefined();
  });
});
