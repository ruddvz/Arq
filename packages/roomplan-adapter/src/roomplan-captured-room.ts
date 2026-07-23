/**
 * ARQ-173: ipad: prototype RoomPlan conversion.
 *
 * Plain data shapes mirroring Apple RoomPlan's real output structure
 * (`CapturedRoom`: walls and openings, each with a stable `identifier`
 * and a `.low`/`.medium`/`.high` confidence level, per Apple's public
 * RoomPlan documentation) - not RoomPlan's actual Swift/USD types
 * themselves, since RoomPlan is a native ARKit/LiDAR framework with no
 * web or Node binding at all; nothing in this package captures a room.
 * Capture (blueprint section 109 step 1) needs real LiDAR-equipped
 * hardware and the native RoomPlan API, neither of which exists in this
 * sandboxed environment - this package starts from step 2 onward
 * ("confidence"), taking an already-captured room as plain input.
 *
 * Lengths arrive in metres, RoomPlan/ARKit's own native unit (USD scenes
 * are metre-scaled by convention) - `roomplan-converter.ts` is where the
 * "unit and coordinate check" (section 109 step 3) converts to
 * millimetres for ArqScript.
 */

export type RoomPlanConfidence = 'low' | 'medium' | 'high';

export interface RoomPlanPoint2 {
  readonly xMeters: number;
  readonly yMeters: number;
}

export interface RoomPlanWall {
  /** RoomPlan's own stable per-surface identifier - the source scan provenance link (section 109 step 11). */
  readonly identifier: string;
  readonly confidence: RoomPlanConfidence;
  readonly startMeters: RoomPlanPoint2;
  readonly endMeters: RoomPlanPoint2;
  readonly heightMeters: number;
}

export interface RoomPlanOpening {
  readonly identifier: string;
  readonly kind: 'door' | 'window';
  readonly confidence: RoomPlanConfidence;
  readonly hostWallIdentifier: string;
  readonly widthMeters: number;
  readonly heightMeters: number;
  /** Distance along the host wall, from its start point, to this opening's centre. */
  readonly offsetMeters: number;
}

export interface RoomPlanCapturedRoom {
  readonly walls: readonly RoomPlanWall[];
  readonly openings: readonly RoomPlanOpening[];
}
