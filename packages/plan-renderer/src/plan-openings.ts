import { doorLeafPlacement, worldPoint, type WorldPoint } from '@arq/geometry-2d';

/**
 * Where a hosted opening lands on a plan, in world coordinates.
 *
 * Plan is not a slice of the 3D model with the vertical thrown away. A door in
 * plan is a gap in the wall poché, a leaf line and a swing arc; a window is a
 * gap with glazing drawn across it. None of those three exist in the extruded
 * geometry `@arq/geometry-3d`'s `generateWallOpeningMeshes` produces, and the
 * sill and head heights that module needs mean nothing here. So this is its own
 * projection rather than a reuse of that one, and the two share the canonical
 * opening record rather than sharing an implementation.
 *
 * Deliberately generic over plain numbers rather than over bim-core's `Opening`,
 * matching the boundary `wall-opening-meshes.ts` already keeps: a caller maps a
 * real Opening's typed Length fields to these millimetre numbers, and this
 * package stays free of the domain model.
 */

export interface PlanOpeningInput {
  readonly id: string;
  readonly kind: 'door' | 'window' | 'void';
  /** Distance along the host wall's centreline, from its start point. */
  readonly offsetFromWallStart: number;
  readonly width: number;
  /**
   * Which side of the wall the leaf swings to, looking along the wall from its
   * start point. Doors only; ignored for the other kinds.
   */
  readonly side?: 'left' | 'right';
  /** Which end of the opening the leaf is hinged at. Doors only. */
  readonly hand?: 'left' | 'right';
  /** Degrees, 0 to 180. Doors only. */
  readonly swingAngle?: number;
}

export interface PlanWallHost {
  readonly start: WorldPoint;
  readonly end: WorldPoint;
  readonly thickness: number;
}

export interface PlanSegment {
  readonly start: WorldPoint;
  readonly end: WorldPoint;
}

export interface PlanSwingArc {
  /** The hinge. */
  readonly centre: WorldPoint;
  readonly radius: number;
  /** Radians, measured the way `Math.atan2` measures, and swept from start to end. */
  readonly startAngle: number;
  readonly endAngle: number;
  /** True when the sweep runs clockwise in world axes, which a renderer needs to draw it the short way. */
  readonly clockwise: boolean;
}

export interface PlanOpening {
  readonly id: string;
  readonly kind: 'door' | 'window' | 'void';
  /**
   * The void cut through the wall, as a closed quadrilateral. Subtracting this
   * from the wall footprint is what makes an opening read as a gap rather than
   * as a line drawn on top of a solid wall.
   */
  readonly reveal: readonly WorldPoint[];
  /** The two jamb lines that close the poché where the wall stops. */
  readonly jambs: readonly PlanSegment[];
  /** The door leaf in its open position, or null for anything that is not a door. */
  readonly leaf: PlanSegment | null;
  readonly swing: PlanSwingArc | null;
  /** Glazing across the reveal. Windows only. */
  readonly glazing: readonly PlanSegment[];
  /**
   * The glass itself, as a closed band within the reveal. Windows only.
   *
   * The centreline in `glazing` was the whole window symbol, and at a domestic
   * plan scale it is a hairline in a white gap - the fixture's own coordinated
   * drawings give the glass a visible band, and side by side theirs is the one
   * where a reader can tell a window from a doorway without counting jambs.
   *
   * Narrower than the reveal because glass is thinner than the wall it sits in.
   * Filling the whole reveal would say the opening is solid glass from face to
   * face, which is a different detail and a rarer one.
   */
  readonly pane: readonly WorldPoint[] | null;
}

/**
 * How much of the wall's thickness the glass band occupies.
 *
 * A third: thick enough to read as a pane at 1:100, thin enough to leave the
 * reveal visible either side of it, which is what says the glass sits inside a
 * wall rather than replacing it.
 */
const PANE_THICKNESS_FRACTION = 1 / 3;

/** Below this the opening is not a hole, and its reveal would be degenerate. */
const MIN_WIDTH = 1e-6;

/**
 * Projects one opening onto its host wall. Returns null when the wall has no
 * length or the opening no width - both of which the reader already refuses, so
 * reaching null here means a caller built an input by hand.
 */
export function planOpening(host: PlanWallHost, opening: PlanOpeningInput): PlanOpening | null {
  const dx = host.end.x - host.start.x;
  const dy = host.end.y - host.start.y;
  const length = Math.hypot(dx, dy);
  if (length <= MIN_WIDTH || opening.width <= MIN_WIDTH) return null;

  // Along the wall, and across it. `across` is the left-hand normal: rotating
  // the direction a quarter turn anticlockwise, so "left" and "right" below are
  // stated looking along the wall from its start point, which is the only
  // description that stays true when a wall is drawn in either direction.
  const ux = dx / length;
  const uy = dy / length;
  const nx = -uy;
  const ny = ux;

  const half = host.thickness / 2;
  const a0 = opening.offsetFromWallStart;
  const a1 = a0 + opening.width;

  const at = (along: number, across: number): WorldPoint =>
    worldPoint(host.start.x + ux * along + nx * across, host.start.y + uy * along + ny * across);

  const reveal = [at(a0, half), at(a1, half), at(a1, -half), at(a0, -half)];
  const jambs: readonly PlanSegment[] = [
    { start: at(a0, half), end: at(a0, -half) },
    { start: at(a1, half), end: at(a1, -half) },
  ];

  if (opening.kind === 'door') {
    const placement = doorLeafPlacement({ start: host.start, end: host.end }, opening);
    // Null only for the degenerate wall and opening already refused above, so
    // this is unreachable rather than a real fallback - a door with no leaf is
    // still a door-shaped hole with its jambs, which is more honest than a
    // thrown error losing the whole drawing.
    return placement === null
      ? {
          id: opening.id,
          kind: 'door',
          reveal,
          jambs,
          leaf: null,
          swing: null,
          glazing: [],
          pane: null,
        }
      : {
          id: opening.id,
          kind: 'door',
          reveal,
          jambs,
          leaf: { start: placement.hinge, end: placement.tip },
          swing: {
            centre: placement.hinge,
            radius: opening.width,
            startAngle: placement.closedAngle,
            endAngle: placement.openAngle,
            clockwise: placement.clockwise,
          },
          glazing: [],
          pane: null,
        };
  }

  if (opening.kind === 'window') {
    // One line on the wall centreline. Two lines at the faces would read as the
    // wall continuing through the opening, which is the thing the reveal exists
    // to deny.
    return {
      id: opening.id,
      kind: 'window',
      reveal,
      jambs,
      leaf: null,
      swing: null,
      glazing: [{ start: at(a0, 0), end: at(a1, 0) }],
      pane: [
        at(a0, half * PANE_THICKNESS_FRACTION),
        at(a1, half * PANE_THICKNESS_FRACTION),
        at(a1, -half * PANE_THICKNESS_FRACTION),
        at(a0, -half * PANE_THICKNESS_FRACTION),
      ],
    };
  }

  // A void: a hole with nothing in it. It gets a reveal and jambs and nothing
  // else, which is exactly what it is.
  return {
    id: opening.id,
    kind: opening.kind,
    reveal,
    jambs,
    leaf: null,
    swing: null,
    glazing: [],
    pane: null,
  };
}

/**
 * Projects every opening hosted by one wall, dropping any that cannot be placed
 * rather than throwing: a single unplaceable opening should cost its own glyph,
 * not the whole drawing.
 */
export function planOpeningsForWall(
  host: PlanWallHost,
  openings: readonly PlanOpeningInput[],
): readonly PlanOpening[] {
  const placed: PlanOpening[] = [];
  for (const opening of openings) {
    const result = planOpening(host, opening);
    if (result !== null) placed.push(result);
  }
  return placed;
}

/**
 * The stretches of wall that remain solid once its openings are cut out, as
 * sub-segments of the centreline.
 *
 * This is what makes an opening a hole rather than a decoration. The
 * alternative - drawing the whole wall and then painting the reveal in the
 * paper colour on top - looks the same until anything is layered underneath it,
 * and it is not a gap, it is a lid. Splitting the footprint is also what
 * `generateWallOpeningMeshes` does in three dimensions, so plan and model
 * disagree about nothing.
 *
 * Overlapping openings are merged rather than refused: the reader already
 * rejects a model whose openings run past their wall, and two that overlap each
 * other still describe one continuous hole.
 */
export function wallPiers(
  host: PlanWallHost,
  openings: readonly PlanOpeningInput[],
): readonly PlanSegment[] {
  const dx = host.end.x - host.start.x;
  const dy = host.end.y - host.start.y;
  const length = Math.hypot(dx, dy);
  if (length <= MIN_WIDTH) return [];

  const ux = dx / length;
  const uy = dy / length;
  const at = (along: number): WorldPoint =>
    worldPoint(host.start.x + ux * along, host.start.y + uy * along);

  const holes = openings
    .filter((opening) => opening.width > MIN_WIDTH)
    .map((opening) => ({
      from: Math.max(0, opening.offsetFromWallStart),
      to: Math.min(length, opening.offsetFromWallStart + opening.width),
    }))
    .filter((hole) => hole.to > hole.from)
    .sort((a, b) => a.from - b.from);

  const piers: PlanSegment[] = [];
  let cursor = 0;
  for (const hole of holes) {
    if (hole.from - cursor > MIN_WIDTH) {
      piers.push({ start: at(cursor), end: at(hole.from) });
    }
    cursor = Math.max(cursor, hole.to);
  }
  if (length - cursor > MIN_WIDTH) {
    piers.push({ start: at(cursor), end: at(length) });
  }
  return piers;
}

/**
 * A swing arc as a polyline, because the plan scene draws polygons, lines and
 * text and has no arc of its own. Widening that vocabulary for one glyph would
 * push an arc through every consumer of a plan primitive - the sheet exporter,
 * the hit test, the selection handles - for a curve a renderer approximates
 * anyway. The segment count follows the swept angle so a quarter turn and a
 * half turn are drawn to the same smoothness.
 */
export function swingPolyline(swing: PlanSwingArc, segmentsPerRadian = 12): readonly WorldPoint[] {
  const sweep = swing.endAngle - swing.startAngle;
  const steps = Math.max(2, Math.ceil(Math.abs(sweep) * segmentsPerRadian));
  const points: WorldPoint[] = [];
  for (let step = 0; step <= steps; step += 1) {
    const angle = swing.startAngle + (sweep * step) / steps;
    points.push(
      worldPoint(
        swing.centre.x + Math.cos(angle) * swing.radius,
        swing.centre.y + Math.sin(angle) * swing.radius,
      ),
    );
  }
  return points;
}
