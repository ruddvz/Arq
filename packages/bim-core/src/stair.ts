import { toMillimetres, type Length } from './length';
import type { LevelId, MaterialId, StairId, StairTypeId } from './ids';

/**
 * V3-082: stairs, deliberately bounded to a straight single flight.
 *
 * The pack scopes this as "bounded StairType and StairInstance", and the bound
 * is the design. A general stair - winders, spiral, multi-flight with landings,
 * curved stringers - is a geometry problem large enough to distort the semantic
 * model if it arrives early, and the parts of it that matter to a plan drawing
 * are the same regardless: how many risers, how tall each one is, how deep the
 * treads are, and whether that combination is legal.
 *
 * So this models the straight flight and refuses to imply more. A shape it
 * cannot describe is absent rather than approximated, because a stair silently
 * flattened into a straight run is worse than no stair: it draws, schedules and
 * dimensions as something the building is not.
 *
 * The riser count rather than the riser height is the stored quantity. Total
 * rise is fixed by the levels the stair connects, so given a count the height
 * follows exactly, whereas storing the height means the flight generally fails
 * to land on the upper level by a fraction of a millimetre.
 */

export type StairFunction = 'primary' | 'secondary' | 'egress' | 'unknown';

export interface StairType {
  readonly id: StairTypeId;
  readonly name: string;
  readonly function: StairFunction;
  /** Horizontal depth of one tread. */
  readonly treadDepth: Length;
  readonly width: Length;
  readonly materialId?: MaterialId;
}

export interface StairInstance {
  readonly id: StairId;
  readonly typeId: StairTypeId;
  /** The level the flight starts from. */
  readonly baseLevelId: LevelId;
  /** The level it arrives at. Together with the base these fix the total rise. */
  readonly topLevelId: LevelId;
  /**
   * Number of risers, not treads. A straight flight between two levels always
   * has one more riser than tread, and naming the ambiguous quantity is how
   * off-by-one stairs get built.
   */
  readonly riserCount: number;
  /** Where the flight begins, as an opaque reference into the plan model. */
  readonly startReferenceId: string;
  /** Direction of travel in the plan, degrees clockwise from the x axis. */
  readonly directionDegrees: number;
  readonly materialId?: MaterialId;
}

/**
 * Comfort and code limits for a straight flight.
 *
 * Provisional and clearly labelled as such. Real riser and tread limits come
 * from the governing building code, which varies by jurisdiction and by
 * occupancy, and hardcoding one country's numbers as if they were universal is
 * how a tool tells an architect their compliant stair is wrong. These exist so
 * validation has something to check against and so the shape of the check is
 * settled; the values are a placeholder for a code profile.
 */
export const PROVISIONAL_STAIR_LIMITS = {
  maxRiserHeightMm: 190,
  minRiserHeightMm: 100,
  minTreadDepthMm: 250,
  /** Blondel's rule: 2R + T should fall in a comfortable band. */
  minTwoRisersPlusTreadMm: 550,
  maxTwoRisersPlusTreadMm: 700,
} as const;

export type StairValidationCode =
  | 'riser-count-invalid'
  | 'riser-too-tall'
  | 'riser-too-short'
  | 'tread-too-shallow'
  | 'proportion-uncomfortable';

export interface StairValidationFinding {
  readonly code: StairValidationCode;
  readonly detail: string;
  /**
   * Provisional findings come from the placeholder limits above rather than an
   * accepted code profile, so a surface can present them as guidance rather
   * than as a compliance verdict it is not entitled to give.
   */
  readonly provisional: boolean;
}

/**
 * Checks a flight against the provisional limits.
 *
 * Takes the total rise as a parameter rather than resolving the two levels
 * itself: this module has no level table, and taking one would make a small
 * semantic type depend on the whole project model.
 */
export function validateStairFlight(
  instance: Pick<StairInstance, 'riserCount'>,
  treadDepth: Length,
  totalRise: Length,
): readonly StairValidationFinding[] {
  const findings: StairValidationFinding[] = [];

  if (!Number.isInteger(instance.riserCount) || instance.riserCount < 1) {
    // Nothing downstream is meaningful without a valid count - riser height is
    // a division by it - so this returns rather than reporting cascade noise.
    return [
      {
        code: 'riser-count-invalid',
        detail: `riser count must be a whole number of at least 1, got ${instance.riserCount}`,
        provisional: false,
      },
    ];
  }

  const riserMm = toMillimetres(totalRise) / instance.riserCount;
  const treadMm = toMillimetres(treadDepth);

  if (riserMm > PROVISIONAL_STAIR_LIMITS.maxRiserHeightMm) {
    findings.push({
      code: 'riser-too-tall',
      detail: `${riserMm.toFixed(1)}mm exceeds ${PROVISIONAL_STAIR_LIMITS.maxRiserHeightMm}mm`,
      provisional: true,
    });
  }
  if (riserMm < PROVISIONAL_STAIR_LIMITS.minRiserHeightMm) {
    findings.push({
      code: 'riser-too-short',
      detail: `${riserMm.toFixed(1)}mm is below ${PROVISIONAL_STAIR_LIMITS.minRiserHeightMm}mm`,
      provisional: true,
    });
  }
  if (treadMm < PROVISIONAL_STAIR_LIMITS.minTreadDepthMm) {
    findings.push({
      code: 'tread-too-shallow',
      detail: `${treadMm.toFixed(1)}mm is below ${PROVISIONAL_STAIR_LIMITS.minTreadDepthMm}mm`,
      provisional: true,
    });
  }

  const blondel = 2 * riserMm + treadMm;
  if (
    blondel < PROVISIONAL_STAIR_LIMITS.minTwoRisersPlusTreadMm ||
    blondel > PROVISIONAL_STAIR_LIMITS.maxTwoRisersPlusTreadMm
  ) {
    findings.push({
      code: 'proportion-uncomfortable',
      detail: `2R+T is ${blondel.toFixed(1)}mm, outside ${PROVISIONAL_STAIR_LIMITS.minTwoRisersPlusTreadMm}-${PROVISIONAL_STAIR_LIMITS.maxTwoRisersPlusTreadMm}mm`,
      provisional: true,
    });
  }

  return findings;
}

/** Riser height implied by the count and the rise it has to cover. */
export function riserHeightMm(totalRise: Length, riserCount: number): number {
  return toMillimetres(totalRise) / riserCount;
}

/** A straight flight always has one fewer tread than riser: the top landing is the last step. */
export function treadCount(riserCount: number): number {
  return Math.max(0, riserCount - 1);
}

export const STAIR_TYPE_DERIVED_INVALIDATIONS = [
  'stair-solid',
  'plan-symbol',
  'section-profile',
  'circulation-check',
] as const;
