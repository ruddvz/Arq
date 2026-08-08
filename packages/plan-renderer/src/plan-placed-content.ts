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
      ...(furnishing.material == null ? {} : { fillTint: furnishing.material }),
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
