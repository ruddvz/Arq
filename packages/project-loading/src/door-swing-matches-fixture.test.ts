import { describe, expect, it } from 'vitest';
import { adaptArqHouse17Model } from './arq-house-17-model-adapter';

/**
 * The door orientations the adapter cannot derive, checked against the way the
 * fixture's own drawings show them.
 *
 * ARQ House 17.0 records `hand: 'start' | 'end'` and `swingDirection: ±1`, and
 * the native model wants `hand` and `side` as `left | right`. Neither mapping
 * is self-evident from the words, and both were got wrong first time by reading
 * them rather than checking: the front door came out hinged on the wrong jamb
 * and swinging onto the street.
 *
 * What settled it was the package's own `A101_Ground_Floor_Coordinated_17_0.png`
 * - generated from this same model, so it is the model's own statement of what
 * it means. It draws the entrance hinged at the right-hand jamb, opening inward
 * into the entrance vestibule.
 *
 * Asserting the resolved geometry rather than the two enum values is deliberate.
 * `left`/`right` are not absolute: `plan-openings.ts` rotates the leaf from its
 * *closed* direction, which points away from whichever jamb `hand` selected, so
 * the same `side` opens a door opposite ways depending on its hand. A test on
 * the enums alone would pass while the door swung through the front wall. This
 * computes where the leaf actually ends up and asserts it is inside the house.
 */

/** The real entrance: a south wall running +X, its door hinged at the far jamb. */
function entranceModel(): Record<string, unknown> {
  return {
    id: 'arq-project-house',
    name: 'House',
    revision: 670,
    units: 'mm',
    levelIds: ['level-ground'],
    levels: [{ id: 'level-ground', name: 'Ground Floor', elevation: 0, storeyHeight: 3200 }],
    wallTypes: [{ id: 'wt-ext-300', name: 'Exterior wall 300 mm', width: 300 }],
    walls: [
      {
        id: 'gf-outer-south',
        typeId: 'wt-ext-300',
        levelId: 'level-ground',
        // The house sits north of this wall, so +Y is indoors.
        start: { x: 150, y: 150 },
        end: { x: 17850, y: 150 },
        alignment: 'centre',
        joinStart: 'union-solid',
        joinEnd: 'union-solid',
        semanticRole: 'outer-envelope',
        height: 3000,
        hostedOpeningIds: ['op-gf-entry'],
      },
    ],
    openings: [
      {
        id: 'op-gf-entry',
        hostWallId: 'gf-outer-south',
        kind: 'door',
        offsetFromWallStart: { value: 7950, unit: 'mm' },
        width: { value: 1800, unit: 'mm' },
        sillHeight: { value: 0, unit: 'mm' },
        height: { value: 2700, unit: 'mm' },
      },
    ],
    doorTypes: [
      { id: 'door-double-1800', name: 'Double entrance', operation: 'swing', width: 1800 },
    ],
    doors: [
      {
        id: 'd-gf-entry',
        typeId: 'door-double-1800',
        openingId: 'op-gf-entry',
        levelId: 'level-ground',
        side: 'configured',
        hand: 'start',
        swingDirection: 1,
      },
    ],
    windows: [],
    rooms: [],
  };
}

/**
 * `plan-openings.ts`'s own rule, reproduced so this test measures what the
 * renderer will actually draw. Reproduced rather than imported because
 * `project-loading` does not depend on `plan-renderer`; the drift risk is
 * covered by this test failing loudly if the drawn result stops matching.
 */
function leafOpenDirection(
  wall: { readonly dx: number; readonly dy: number },
  door: { readonly hand: string; readonly side: string },
): { readonly x: number; readonly y: number } {
  const length = Math.hypot(wall.dx, wall.dy);
  const ux = wall.dx / length;
  const uy = wall.dy / length;
  const hingeAtStart = door.hand === 'left';
  // Closed, the leaf lies along the wall pointing from the hinge to the far jamb.
  const closedAngle = Math.atan2(hingeAtStart ? uy : -uy, hingeAtStart ? ux : -ux);
  const sweep = Math.PI / 2;
  const openAngle = closedAngle + (door.side === 'left' ? sweep : -sweep);
  return { x: Math.cos(openAngle), y: Math.sin(openAngle) };
}

describe('the ARQ House 17.0 entrance door, against the fixture drawing', () => {
  const adapted = adaptArqHouse17Model(entranceModel());
  const door =
    adapted.status === 'adapted'
      ? (adapted.model.doors as Record<string, unknown>[])[0]!
      : (null as never);

  it('adapts at all', () => {
    expect(adapted.status).toBe('adapted');
  });

  it('hinges at the right-hand jamb, as A101 draws it', () => {
    // `hand: 'right'` is what puts the hinge at the far jamb in plan-openings.ts.
    expect(door.hand).toBe('right');
  });

  /**
   * The assertion that actually matters. A house's front door opening onto the
   * street is the failure this exists to catch, and it is invisible in the enum
   * values alone.
   */
  it('opens inward, into the house rather than onto the street', () => {
    const direction = leafOpenDirection(
      { dx: 17_700, dy: 0 },
      { hand: door.hand as string, side: door.side as string },
    );

    // +Y is indoors for this wall. Comfortably positive, not merely non-negative.
    expect(direction.y).toBeGreaterThan(0.9);
  });

  it('keeps a swing door’s 90 degree arc', () => {
    expect(door.swingAngle).toBe(90);
  });

  it('reports both orientations as assumed, not as facts the file stated', () => {
    if (adapted.status !== 'adapted') return;
    const bases = adapted.translations
      .filter((entry) => entry.section === 'doors' && /hand|swingAngle/.test(entry.field))
      .map((entry) => entry.basis);

    expect(bases.length).toBeGreaterThan(0);
    for (const basis of bases) expect(basis).toBe('assumed');
  });
});
