import { describe, expect, it } from 'vitest';
import { worldPoint, type WorldPoint } from '@arq/geometry-2d';
import { hatchSegments } from './room-hatch';

function rect(x0: number, y0: number, x1: number, y1: number): readonly WorldPoint[] {
  return [worldPoint(x0, y0), worldPoint(x1, y0), worldPoint(x1, y1), worldPoint(x0, y1)];
}

/** Independent point-in-polygon, so the assertions do not lean on the module. */
function inside(polygon: readonly WorldPoint[], x: number, y: number): boolean {
  let odd = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i, i += 1) {
    const a = polygon[i]!;
    const b = polygon[j]!;
    if (a.y > y !== b.y > y && x < ((b.x - a.x) * (y - a.y)) / (b.y - a.y) + a.x) {
      odd = !odd;
    }
  }
  return odd;
}

const length = (s: { start: WorldPoint; end: WorldPoint }): number =>
  Math.hypot(s.end.x - s.start.x, s.end.y - s.start.y);

describe('hatchSegments', () => {
  it('draws inside the room and nowhere else', () => {
    const room = rect(0, 0, 4000, 3000);
    const segments = hatchSegments(room, 300, Math.PI / 4);
    expect(segments.length).toBeGreaterThan(5);
    for (const segment of segments) {
      // Midpoints rather than endpoints: an endpoint sits exactly on the
      // boundary by construction, which a parity test may call either way.
      const midX = (segment.start.x + segment.end.x) / 2;
      const midY = (segment.start.y + segment.end.y) / 2;
      expect(inside(room, midX, midY)).toBe(true);
    }
  });

  it('runs at the angle it was asked for', () => {
    for (const angle of [0, Math.PI / 4, Math.PI / 3, -Math.PI / 6]) {
      const segments = hatchSegments(rect(0, 0, 5000, 5000), 500, angle);
      expect(segments.length).toBeGreaterThan(0);
      for (const segment of segments) {
        const measured = Math.atan2(
          segment.end.y - segment.start.y,
          segment.end.x - segment.start.x,
        );
        // Direction, not orientation: a segment drawn end-to-start is the same
        // line, so compare the axis rather than the heading.
        const difference = Math.abs(Math.sin(measured - angle));
        expect(difference).toBeLessThan(1e-9);
      }
    }
  });

  it('spaces the lines as asked, measured across them', () => {
    // Horizontal hatch in a square: the lines are rows, so their y values are
    // the spacing directly.
    const segments = hatchSegments(rect(0, 0, 1000, 1000), 200, 0);
    const rows = [...new Set(segments.map((s) => Math.round(s.start.y)))].sort((a, b) => a - b);
    expect(rows.length).toBeGreaterThan(2);
    for (let i = 1; i < rows.length; i += 1) {
      expect(rows[i]! - rows[i - 1]!).toBe(200);
    }
  });

  it('lines up across a shared wall, so two rooms read as one material', () => {
    // Placed on multiples of the spacing from the world origin rather than from
    // each room's own edge. Two rooms that touch then share the hatch grid.
    const left = hatchSegments(rect(0, 0, 1000, 1000), 200, 0);
    const right = hatchSegments(rect(1000, 0, 2000, 1000), 200, 0);
    const rowsOf = (segments: readonly { start: WorldPoint }[]): number[] =>
      [...new Set(segments.map((s) => Math.round(s.start.y)))].sort((a, b) => a - b);
    expect(rowsOf(left)).toEqual(rowsOf(right));
  });

  it('breaks around a notch rather than crossing it', () => {
    /*
     * A C-shape. A horizontal line through the opening is inside the ring
     * twice, so it must be drawn as two spans with a gap - the even-odd rule.
     * A naive "first crossing to last crossing" would paint straight over the
     * notch, which on a plan means hatching over a room that is not there.
     */
    const cShape: readonly WorldPoint[] = [
      worldPoint(0, 0),
      worldPoint(3000, 0),
      worldPoint(3000, 1000),
      worldPoint(1000, 1000),
      worldPoint(1000, 2000),
      worldPoint(3000, 2000),
      worldPoint(3000, 3000),
      worldPoint(0, 3000),
    ];
    const segments = hatchSegments(cShape, 250, 0);
    const throughNotch = segments.filter((s) => s.start.y > 1000 && s.start.y < 2000);
    expect(throughNotch.length).toBeGreaterThan(0);
    for (const segment of throughNotch) {
      // The notch starts at x = 1000; nothing may reach past it.
      expect(Math.max(segment.start.x, segment.end.x)).toBeLessThanOrEqual(1000 + 1e-6);
    }
  });

  it('does not leak out of a room whose corner a line happens to touch', () => {
    // A diamond: every hatch line at 45 degrees meets a vertex exactly. The
    // half-open crossing rule is what stops that counting twice.
    const diamond: readonly WorldPoint[] = [
      worldPoint(0, 1000),
      worldPoint(1000, 0),
      worldPoint(2000, 1000),
      worldPoint(1000, 2000),
    ];
    for (const segment of hatchSegments(diamond, 250, Math.PI / 4)) {
      const midX = (segment.start.x + segment.end.x) / 2;
      const midY = (segment.start.y + segment.end.y) / 2;
      expect(inside(diamond, midX, midY)).toBe(true);
    }
  });

  it('drops a span of no length rather than putting a dot on a corner', () => {
    for (const segment of hatchSegments(rect(0, 0, 2000, 2000), 100, Math.PI / 4)) {
      expect(length(segment)).toBeGreaterThan(0);
    }
  });

  it('hatches nothing it cannot measure, rather than throwing mid-paint', () => {
    const room = rect(0, 0, 1000, 1000);
    // A room drawn without hatching is a far better outcome than a plan that
    // stops painting at the room that could not be hatched.
    expect(hatchSegments(room, 0, 0)).toEqual([]);
    expect(hatchSegments(room, -100, 0)).toEqual([]);
    expect(hatchSegments(room, Number.NaN, 0)).toEqual([]);
    expect(hatchSegments(room, 100, Number.NaN)).toEqual([]);
    expect(hatchSegments([worldPoint(0, 0), worldPoint(1, 1)], 100, 0)).toEqual([]);
  });

  it('hatches a room smaller than one spacing without drawing outside it', () => {
    // The spacing grid may miss a small room entirely. Missing it is correct;
    // stretching a line to fit would be hatching that is not to scale.
    for (const segment of hatchSegments(rect(0, 0, 50, 50), 1000, 0)) {
      expect(
        inside(rect(0, 0, 50, 50), (segment.start.x + segment.end.x) / 2, segment.start.y),
      ).toBe(true);
    }
  });
});
