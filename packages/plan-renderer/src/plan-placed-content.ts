/**
 * Plan primitives for the content that stands on a level and is not a wall:
 * furnishings, floor and roof plates, and stairs.
 *
 * It lives here rather than in the app for the same reason `plan-openings.ts`
 * does: how a stair reads in plan is a drawing rule, not a screen-layout
 * detail, and a rule written in a component is a rule nothing can test without
 * a canvas. The inputs are plain shapes rather than `@arq/project-loading`
 * types, because a renderer that imports the loader has been handed the loader's
 * whole vocabulary to keep working against - the same boundary every other
 * module in this package holds.
 *
 * ## What a stair has to say
 *
 * A stair drawn as its outline alone is a rectangle, and a rectangle is not a
 * stair - it is indistinguishable from a cupboard. Two things make it readable
 * and both come from the file rather than from a convention: the nosing lines,
 * evenly spaced by the flight's own tread count, and the direction of travel,
 * drawn as an arrow up the walking line. A reader who cannot tell which way a
 * stair rises cannot tell a plan of a house from a plan of its mirror image.
 *
 * The arrow is drawn only when the flight is long enough to hold one. A head
 * larger than the run it sits on reads as a blot rather than as a direction,
 * which is worse than leaving the flight unmarked and letting the nosings speak.
 */
import type { WorldPoint } from '@arq/geometry-2d';
import { worldPoint } from '@arq/geometry-2d';
import type { PlanPrimitiveInput } from './plan-scene';

/** A closed footprint. Four corners for everything this draws, but not required to be. */
export interface PlacedFootprint {
  readonly id: string;
  readonly footprint: readonly WorldPoint[];
}

export interface PlanFurnishingInput extends PlacedFootprint {
  /**
   * The material the model states, used as the fill tint key. Absent, or a name
   * the palette does not carry, draws the outline alone - see
   * `canvas2d-paint.ts` for why an unknown material is not given a colour.
   */
  readonly material?: string | null;
}

export interface PlanSlabInput {
  readonly id: string;
  /** The plate's outer boundary. */
  readonly outline: readonly WorldPoint[];
  /** Holes through it - a courtyard, a stairwell. */
  readonly voids: readonly (readonly WorldPoint[])[];
}

export interface PlanStairFlightInput extends PlacedFootprint {
  /** Where the walking line enters, at the bottom of the flight. */
  readonly start: WorldPoint;
  /** Where it leaves, at the top. */
  readonly end: WorldPoint;
  /** How many treads the run is divided into. */
  readonly treadCount: number;
}

export interface PlanStairInput {
  readonly id: string;
  readonly flights: readonly PlanStairFlightInput[];
  readonly landings: readonly PlacedFootprint[];
}

/**
 * The shortest run worth putting a direction arrow on, in world millimetres.
 *
 * Below this the head and the shaft together are longer than the flight, so the
 * arrow reads as a shape rather than as a direction. Set from the head length
 * below: three heads of run is the least that still looks like a line with a
 * point on it.
 */
const MIN_ARROW_RUN_MM = 900;

/** Arrowhead length, in world millimetres - about one tread deep, so it sits in scale with the nosings. */
const ARROW_HEAD_MM = 300;

/** Half-angle of the arrowhead, in radians. 30 degrees is the usual drafting barb. */
const ARROW_HEAD_HALF_ANGLE = Math.PI / 6;

/**
 * A furnishing, as a filled body with its outline on top.
 *
 * Drawn as an outline alone at first, reasoning that 140 filled shapes would
 * hide the plan they annotate. The fixture's own coordinated drawings fill
 * them, and side by side the filled drawing is the more readable: an outlined
 * wardrobe against an outlined wall is two rectangles sharing an edge, while a
 * filled one is plainly an object standing against a wall.
 *
 * The tint is the material the model already states, so the fill carries
 * information rather than decoration - a glazed shower screen and a stone
 * counter are the same rectangle otherwise. A material the palette has no
 * colour for falls back to the outline, rather than being coloured as something
 * it is not.
 */
export function furnishingPrimitives(
  furnishing: PlanFurnishingInput,
): readonly PlanPrimitiveInput<string>[] {
  if (furnishing.footprint.length < 3) return [];
  return [
    {
      kind: 'polygon',
      elementId: furnishing.id,
      points: furnishing.footprint,
      fill: 'furnishing',
      ...(furnishing.material === null || furnishing.material === undefined
        ? {}
        : { fillTint: furnishing.material }),
    },
  ];
}

/**
 * The plate's edge and the holes through it.
 *
 * The voids are the reason this is drawn at all. A floor opening - the
 * courtyard, the stairwell - is a place a person can fall through, and a plan
 * that does not draw it is describing a floor that is not there. The outer edge
 * comes with it because the two are one plate and drawing a hole without its
 * boundary invites the reading that the hole is an object.
 */
export function slabPrimitives(slab: PlanSlabInput): readonly PlanPrimitiveInput<string>[] {
  const primitives: PlanPrimitiveInput<string>[] = [];
  if (slab.outline.length >= 3) {
    primitives.push({ kind: 'polygon', elementId: slab.id, points: slab.outline });
  }
  for (const [index, hole] of slab.voids.entries()) {
    if (hole.length < 3) continue;
    primitives.push({ kind: 'polygon', elementId: `${slab.id}-void-${index}`, points: hole });
  }
  return primitives;
}

/** The nosing lines of one flight, perpendicular to travel and evenly spaced along it. */
function nosingLines(flight: PlanStairFlightInput): readonly PlanPrimitiveInput<string>[] {
  const treads = Math.floor(flight.treadCount);
  if (treads < 1) return [];
  const runX = flight.end.x - flight.start.x;
  const runY = flight.end.y - flight.start.y;
  const run = Math.hypot(runX, runY);
  if (run === 0) return [];

  /*
   * The flight's width is measured across the run, from the footprint itself
   * rather than from a separate width field: the footprint is what is drawn, so
   * a nosing derived from it always spans exactly the flight that is on the
   * page, even if the two ever disagree.
   */
  const acrossX = -runY / run;
  const acrossY = runX / run;
  let halfWidth = 0;
  const centreX = (flight.start.x + flight.end.x) / 2;
  const centreY = (flight.start.y + flight.end.y) / 2;
  for (const corner of flight.footprint) {
    halfWidth = Math.max(
      halfWidth,
      Math.abs((corner.x - centreX) * acrossX + (corner.y - centreY) * acrossY),
    );
  }
  if (halfWidth === 0) return [];

  const lines: PlanPrimitiveInput<string>[] = [];
  // `treads` treads have `treads + 1` edges, including the bottom and the top
  // of the run. Drawing only the interior ones leaves the flight open at both
  // ends, which reads as a ramp.
  for (let step = 0; step <= treads; step += 1) {
    const t = step / treads;
    const x = flight.start.x + runX * t;
    const y = flight.start.y + runY * t;
    lines.push({
      kind: 'line',
      elementId: `${flight.id}-nosing-${step}`,
      points: [
        worldPoint(x - acrossX * halfWidth, y - acrossY * halfWidth),
        worldPoint(x + acrossX * halfWidth, y + acrossY * halfWidth),
      ],
    });
  }
  return lines;
}

/** The up-arrow along the walking line, or nothing when the run is too short to carry one. */
function directionArrow(flight: PlanStairFlightInput): readonly PlanPrimitiveInput<string>[] {
  const runX = flight.end.x - flight.start.x;
  const runY = flight.end.y - flight.start.y;
  const run = Math.hypot(runX, runY);
  if (run < MIN_ARROW_RUN_MM) return [];
  const angle = Math.atan2(runY, runX);
  const barb = (sign: number): WorldPoint =>
    worldPoint(
      flight.end.x - ARROW_HEAD_MM * Math.cos(angle + sign * ARROW_HEAD_HALF_ANGLE),
      flight.end.y - ARROW_HEAD_MM * Math.sin(angle + sign * ARROW_HEAD_HALF_ANGLE),
    );
  return [
    {
      kind: 'line',
      elementId: `${flight.id}-travel`,
      points: [flight.start, flight.end],
    },
    {
      // One polyline rather than two lines: a head drawn as two independent
      // strokes can be selected, hidden or styled by halves.
      kind: 'line',
      elementId: `${flight.id}-travel-head`,
      points: [barb(-1), flight.end, barb(1)],
    },
  ];
}

/**
 * Symbol radius for a services point, in world millimetres.
 *
 * 180mm is roughly the size a drawn luminaire symbol is at 1:100 - large enough
 * to tell one discipline's shape from another's, small enough that 126 of them
 * annotate the plan rather than becoming it. In world units rather than screen
 * pixels because a symbol is part of the drawing: zoom in on a bathroom and the
 * WC symbol stays the size of the fitting, not the size of a cursor.
 */
const SERVICE_SYMBOL_RADIUS_MM = 180;

/** How many segments approximate a circle. Twelve reads as round at plan scales. */
const CIRCLE_SEGMENTS = 12;

function circle(
  centre: WorldPoint,
  radius: number,
  segments = CIRCLE_SEGMENTS,
): readonly WorldPoint[] {
  const points: WorldPoint[] = [];
  for (let step = 0; step < segments; step += 1) {
    const angle = (step / segments) * Math.PI * 2;
    points.push(
      worldPoint(centre.x + radius * Math.cos(angle), centre.y + radius * Math.sin(angle)),
    );
  }
  return points;
}

function square(centre: WorldPoint, half: number): readonly WorldPoint[] {
  return [
    worldPoint(centre.x - half, centre.y - half),
    worldPoint(centre.x + half, centre.y - half),
    worldPoint(centre.x + half, centre.y + half),
    worldPoint(centre.x - half, centre.y + half),
  ];
}

export interface PlanServicePointInput {
  readonly id: string;
  readonly discipline: 'lighting' | 'electrical' | 'plumbing' | 'hvac';
  readonly position: WorldPoint;
}

/**
 * One services point, as a symbol whose shape says which discipline it is.
 *
 * Shape rather than colour, and shape rather than a label. Colour alone fails
 * the design system's own rule that status may not be carried by hue; a label
 * at 126 points would bury the plan under text. So each discipline gets a
 * distinguishable outline a reader learns once:
 *
 * - lighting: a circle crossed through, the drafting convention for a luminaire
 * - electrical: a circle with a single radial stem, as an outlet is drawn
 * - plumbing: a circle within a circle, reading as a fitting with a waste
 * - hvac: a square crossed through, since plant is not a point fitting
 *
 * These are recognisable rather than standards-conformant. A real symbol
 * library is per-jurisdiction and per-discipline and is a much larger piece of
 * work; this is enough to tell four disciplines apart on one drawing, which is
 * what the plan needs before it needs anything else.
 */
export function servicePointPrimitives(
  point: PlanServicePointInput,
): readonly PlanPrimitiveInput<string>[] {
  const r = SERVICE_SYMBOL_RADIUS_MM;
  const { position: at, id } = point;
  switch (point.discipline) {
    case 'lighting':
      return [
        { kind: 'polygon', elementId: id, points: circle(at, r) },
        {
          kind: 'line',
          elementId: `${id}-cross-a`,
          points: [worldPoint(at.x - r, at.y), worldPoint(at.x + r, at.y)],
        },
        {
          kind: 'line',
          elementId: `${id}-cross-b`,
          points: [worldPoint(at.x, at.y - r), worldPoint(at.x, at.y + r)],
        },
      ];
    case 'electrical':
      return [
        { kind: 'polygon', elementId: id, points: circle(at, r * 0.7) },
        {
          kind: 'line',
          elementId: `${id}-stem`,
          points: [worldPoint(at.x, at.y + r * 0.7), worldPoint(at.x, at.y + r * 1.6)],
        },
      ];
    case 'plumbing':
      return [
        { kind: 'polygon', elementId: id, points: circle(at, r) },
        { kind: 'polygon', elementId: `${id}-inner`, points: circle(at, r * 0.45, 8) },
      ];
    case 'hvac':
      return [
        { kind: 'polygon', elementId: id, points: square(at, r) },
        {
          kind: 'line',
          elementId: `${id}-cross-a`,
          points: [worldPoint(at.x - r, at.y - r), worldPoint(at.x + r, at.y + r)],
        },
        {
          kind: 'line',
          elementId: `${id}-cross-b`,
          points: [worldPoint(at.x - r, at.y + r), worldPoint(at.x + r, at.y - r)],
        },
      ];
  }
}

export interface PlanPathwayInput {
  readonly id: string;
  readonly points: readonly WorldPoint[];
}

/**
 * A walkable route, as its centreline.
 *
 * The centreline and not the swept width band. A band is the drawing a
 * walkability study wants, and it needs a polyline offset with proper join
 * handling - mitres at the bends, and an answer for a bend tighter than the
 * width. An offset that is subtly wrong at the corners draws a route claiming
 * clearances it does not have, and a reader cannot tell that from a correct
 * one. A line claims only where the route runs, which is true.
 */
export function pathwayPrimitives(
  pathway: PlanPathwayInput,
): readonly PlanPrimitiveInput<string>[] {
  if (pathway.points.length < 2) return [];
  return [{ kind: 'line', elementId: pathway.id, points: pathway.points }];
}

/**
 * A stair: each flight's outline, its nosings and its direction, and each
 * landing's outline.
 *
 * Flights and landings are separate primitives rather than one merged outline
 * because they are separate in the file and separate on the ground - a landing
 * is flat and a flight is not, and a reader has to be able to see the join.
 */
export function stairPrimitives(stair: PlanStairInput): readonly PlanPrimitiveInput<string>[] {
  const primitives: PlanPrimitiveInput<string>[] = [];
  for (const landing of stair.landings) {
    if (landing.footprint.length < 3) continue;
    primitives.push({ kind: 'polygon', elementId: landing.id, points: landing.footprint });
  }
  for (const flight of stair.flights) {
    if (flight.footprint.length >= 3) {
      primitives.push({ kind: 'polygon', elementId: flight.id, points: flight.footprint });
    }
    primitives.push(...nosingLines(flight), ...directionArrow(flight));
  }
  return primitives;
}

/**
 * The north arrow's length, as a fraction of the drawing's larger dimension.
 *
 * Proportional rather than fixed, because the arrow belongs to the sheet: it
 * should be the same size relative to the drawing whether the project is a
 * bathroom or a business park. Six per cent is about what a drawn sheet uses -
 * legible, and not competing with the building.
 */
const NORTH_ARROW_FRACTION = 0.06;

/** How far outside the drawing the arrow stands, as a fraction of its own length. */
const NORTH_ARROW_MARGIN = 0.8;

/**
 * A north arrow, placed just outside the drawing's top-right corner.
 *
 * Drawn in world space rather than as screen chrome, so it belongs to the
 * drawing: it exports with the sheet, it sits in a fixed place on the page
 * rather than following the viewport, and it turns with the plan if the plan is
 * ever rotated. A north arrow that stayed upright while the drawing turned
 * would be the one piece of a plan that lies.
 *
 * `bearingDegrees` is clockwise from the model's +Y axis, which is the
 * convention `NativeProjectSummary.northBearingDegrees` normalises to. A
 * project that does not state its north gets no arrow at all - see that field
 * for why null and zero are different answers.
 */
export function northArrowPrimitives(
  bounds: { readonly min: WorldPoint; readonly max: WorldPoint },
  bearingDegrees: number,
): readonly PlanPrimitiveInput<string>[] {
  const width = bounds.max.x - bounds.min.x;
  const height = bounds.max.y - bounds.min.y;
  if (!(width > 0) || !(height > 0) || !Number.isFinite(bearingDegrees)) return [];

  const length = Math.max(width, height) * NORTH_ARROW_FRACTION;
  const margin = length * NORTH_ARROW_MARGIN;
  /*
   * The bottom-right of the drawing, not the top-right.
   *
   * Top-right is where a sheet's north arrow usually goes and where this was
   * put first - and it is also where the workspace floats its view-tools
   * control, so the arrow came out half behind it and clipped by the page edge.
   * The bottom-right corner is beside where a title block would sit, which is
   * the other conventional home for it, and it is empty on this page.
   */
  const originX = bounds.max.x + margin;
  const originY = bounds.min.y + length / 2;

  // Clockwise from +Y: a bearing of 0 points up the page, 90 points right.
  const radians = (bearingDegrees * Math.PI) / 180;
  const dirX = Math.sin(radians);
  const dirY = Math.cos(radians);
  const tipX = originX + dirX * length;
  const tipY = originY + dirY * length;

  // Barbs swept back from the tip, and a tail behind the origin, so the arrow
  // reads as a needle rather than as a line with a triangle stuck on it.
  const barb = length * 0.28;
  const spread = Math.PI / 7;
  const angle = Math.atan2(dirY, dirX);
  const barbPoint = (sign: number): WorldPoint =>
    worldPoint(
      tipX - barb * Math.cos(angle + sign * spread),
      tipY - barb * Math.sin(angle + sign * spread),
    );

  return [
    {
      kind: 'line',
      elementId: 'north-arrow-shaft',
      points: [worldPoint(originX, originY), worldPoint(tipX, tipY)],
    },
    {
      kind: 'line',
      elementId: 'north-arrow-head',
      points: [barbPoint(-1), worldPoint(tipX, tipY), barbPoint(1)],
    },
    {
      // Set beyond the tip along the same bearing, so the letter stays at the
      // pointed end whichever way north runs.
      kind: 'text',
      elementId: 'north-arrow-label',
      anchor: worldPoint(tipX + dirX * barb, tipY + dirY * barb),
      text: 'N',
    },
  ];
}

/**
 * Kind-specific detail drawn inside a furnishing's footprint.
 *
 * A rectangle says a thing is there and nothing about what it is. A WC and a
 * bedside table are the same rectangle; a shower and a wardrobe are the same
 * rectangle. The file names 64 kinds exactly, so the information is there and
 * the drawing was throwing it away.
 *
 * Everything below is built in the footprint's own frame - `u` across it, `v`
 * along it - and mapped out to world coordinates at the end. That is what makes
 * a rotated item's symbol rotate with it: the beds at 90 degrees and the lounge
 * chairs at -10 need no special handling, because the glyph never sees a world
 * axis.
 *
 * Only kinds where the symbol is conventional and unambiguous are drawn. A
 * `media-console` or a `shoe-cabinet` gets its filled body and no glyph,
 * because inventing a symbol for it would teach a reader a vocabulary that
 * exists nowhere else.
 */

/** The footprint's local frame: an origin corner and the two edge vectors from it. */
interface LocalFrame {
  readonly ox: number;
  readonly oy: number;
  readonly ux: number;
  readonly uy: number;
  readonly vx: number;
  readonly vy: number;
}

/**
 * The frame of a four-corner footprint, with `v` pointing away from the side
 * the item faces.
 *
 * Orienting from `facingDirection` is what puts a cistern against the wall
 * rather than across the room. Where the file states no facing, `v` is left as
 * the footprint's own second edge - an arbitrary but stable choice, and the
 * symbols that care about a back are exactly the ones this fixture states a
 * facing for.
 */
function localFrame(footprint: readonly WorldPoint[], facing: string | null): LocalFrame | null {
  if (footprint.length < 4) return null;
  const [a, b, , d] = footprint as readonly [WorldPoint, WorldPoint, WorldPoint, WorldPoint];
  let frame: LocalFrame = {
    ox: a.x,
    oy: a.y,
    ux: b.x - a.x,
    uy: b.y - a.y,
    vx: d.x - a.x,
    vy: d.y - a.y,
  };

  const facingVector: Readonly<Record<string, readonly [number, number]>> = {
    north: [0, 1],
    south: [0, -1],
    east: [1, 0],
    west: [-1, 0],
  };
  const want = facing === null ? undefined : facingVector[facing];
  if (want === undefined) return frame;

  // `v` should point the way the item faces, so "the back" is always v = 0.
  // Whichever edge is more aligned with the facing becomes v, flipped if it
  // currently points the other way.
  const [wx, wy] = want;
  const alongU = frame.ux * wx + frame.uy * wy;
  const alongV = frame.vx * wx + frame.vy * wy;
  if (Math.abs(alongU) > Math.abs(alongV)) {
    frame = {
      ox: frame.ox,
      oy: frame.oy,
      ux: frame.vx,
      uy: frame.vy,
      vx: frame.ux,
      vy: frame.uy,
    };
  }
  const facingAlignment = frame.vx * wx + frame.vy * wy;
  if (facingAlignment < 0) {
    // Move the origin to the opposite corner and reverse v, so v = 0 stays the
    // back edge rather than becoming a point outside the footprint.
    return {
      ox: frame.ox + frame.vx,
      oy: frame.oy + frame.vy,
      ux: frame.ux,
      uy: frame.uy,
      vx: -frame.vx,
      vy: -frame.vy,
    };
  }
  return frame;
}

/** A point in the footprint's frame, where u and v both run 0 to 1. */
function local(frame: LocalFrame, u: number, v: number): WorldPoint {
  return worldPoint(frame.ox + frame.ux * u + frame.vx * v, frame.oy + frame.uy * u + frame.vy * v);
}

/** An ellipse inscribed in the given local rectangle, as a closed ring. */
function localEllipse(
  frame: LocalFrame,
  u0: number,
  v0: number,
  u1: number,
  v1: number,
  segments = 16,
): readonly WorldPoint[] {
  const cu = (u0 + u1) / 2;
  const cv = (v0 + v1) / 2;
  const ru = (u1 - u0) / 2;
  const rv = (v1 - v0) / 2;
  const points: WorldPoint[] = [];
  for (let step = 0; step < segments; step += 1) {
    const angle = (step / segments) * Math.PI * 2;
    points.push(local(frame, cu + ru * Math.cos(angle), cv + rv * Math.sin(angle)));
  }
  return points;
}

function localRing(
  frame: LocalFrame,
  u0: number,
  v0: number,
  u1: number,
  v1: number,
): readonly WorldPoint[] {
  return [local(frame, u0, v0), local(frame, u1, v0), local(frame, u1, v1), local(frame, u0, v1)];
}

/**
 * The glyph for one furnishing kind, in its own frame, or nothing for a kind
 * with no conventional symbol.
 *
 * `v = 0` is the back - against the wall, the head of the bed, the taps.
 */
function kindGlyph(
  kind: string,
  frame: LocalFrame,
  id: string,
): readonly PlanPrimitiveInput<string>[] {
  const ring = (name: string, ...box: [number, number, number, number]) => ({
    kind: 'polygon' as const,
    elementId: `${id}-${name}`,
    points: localRing(frame, ...box),
  });
  const ellipse = (
    name: string,
    u0: number,
    v0: number,
    u1: number,
    v1: number,
    segments?: number,
  ) => ({
    kind: 'polygon' as const,
    elementId: `${id}-${name}`,
    points: localEllipse(frame, u0, v0, u1, v1, segments),
  });
  const line = (name: string, from: [number, number], to: [number, number]) => ({
    kind: 'line' as const,
    elementId: `${id}-${name}`,
    points: [local(frame, from[0], from[1]), local(frame, to[0], to[1])],
  });

  switch (kind) {
    case 'toilet':
      // Cistern across the back, pan as an ellipse in front of it.
      return [ring('cistern', 0.1, 0, 0.9, 0.28), ellipse('pan', 0.2, 0.3, 0.8, 0.98)];
    case 'basin':
    case 'vanity':
      return [ellipse('bowl', 0.28, 0.18, 0.72, 0.85), line('tap', [0.5, 0.06], [0.5, 0.16])];
    case 'double-vanity':
      return [
        ellipse('bowl-a', 0.06, 0.18, 0.44, 0.85),
        ellipse('bowl-b', 0.56, 0.18, 0.94, 0.85),
        line('tap-a', [0.25, 0.06], [0.25, 0.16]),
        line('tap-b', [0.75, 0.06], [0.75, 0.16]),
      ];
    case 'kitchen-sink':
    case 'prep-sink':
    case 'utility-sink':
    case 'outdoor-sink':
      return [ring('bowl', 0.12, 0.2, 0.88, 0.88), line('tap', [0.5, 0.06], [0.5, 0.16])];
    case 'shower':
      // Tray, and the diagonals that mark the fall to the drain.
      return [
        ring('tray', 0.06, 0.06, 0.94, 0.94),
        line('fall-a', [0.06, 0.06], [0.94, 0.94]),
        line('fall-b', [0.94, 0.06], [0.06, 0.94]),
      ];
    case 'bathtub':
      return [ellipse('tub', 0.08, 0.12, 0.92, 0.92), ellipse('waste', 0.44, 0.16, 0.56, 0.3, 8)];
    case 'bed-single':
    case 'bed-queen':
    case 'bed-king':
    case 'daybed':
      // Pillows at the head, and the turn-down line across the foot.
      return [ring('pillow', 0.08, 0.04, 0.92, 0.22), line('turn-down', [0, 0.42], [1, 0.42])];
    case 'hob':
      return [
        ellipse('burner-a', 0.08, 0.1, 0.44, 0.46, 10),
        ellipse('burner-b', 0.56, 0.1, 0.92, 0.46, 10),
        ellipse('burner-c', 0.08, 0.54, 0.44, 0.9, 10),
        ellipse('burner-d', 0.56, 0.54, 0.92, 0.9, 10),
      ];
    case 'sofa':
    case 'sofa-chaise':
    case 'outdoor-sofa':
      // Back along v = 0, arms down each side, seat cushion between them.
      return [
        ring('back', 0, 0, 1, 0.22),
        ring('arm-a', 0, 0.22, 0.14, 1),
        ring('arm-b', 0.86, 0.22, 1, 1),
      ];
    default:
      return [];
  }
}

/**
 * The detail inside a furnishing, for the kinds that have a conventional
 * symbol. Returns nothing for the rest, which keep their filled body.
 */
export function furnishingDetailPrimitives(
  furnishing: PlanFurnishingInput & {
    readonly kind?: string | null;
    readonly facingDirection?: string | null;
  },
): readonly PlanPrimitiveInput<string>[] {
  const kind = furnishing.kind;
  if (kind === null || kind === undefined) return [];
  const frame = localFrame(furnishing.footprint, furnishing.facingDirection ?? null);
  if (frame === null) return [];
  return kindGlyph(kind, frame, furnishing.id);
}
