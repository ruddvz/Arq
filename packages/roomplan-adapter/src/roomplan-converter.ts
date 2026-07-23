/**
 * ARQ-173: ipad: prototype RoomPlan conversion.
 *
 * Implements the buildable half of blueprint section 109's required
 * conversion pipeline - the steps that do not need real LiDAR hardware
 * or the native RoomPlan/ARKit framework, neither of which exists in
 * this sandboxed environment:
 *
 *  1. capture                    - OUT OF SCOPE (native hardware only).
 *  2. confidence                 - preserved per element (`ConvertedElement.confidence`).
 *  3. unit and coordinate check   - metres -> millimetres (`metersToMm`), AND translating
 *                                    every wall point so the room's own bounding-box minimum
 *                                    sits at (0, 0). This is not cosmetic: RoomPlan/ARKit's
 *                                    world-space origin is wherever the device started
 *                                    scanning, so real captured coordinates are routinely
 *                                    negative - @arq/arqscript's own `createWallCommand`
 *                                    rejects a negative coordinate (verified directly, not
 *                                    assumed), so converting a real capture without this
 *                                    translation step would incorrectly fail most real scans.
 *  4. detect walls and openings   - RoomPlan's own job; this module's input already has them.
 *  5. simplify                    - NOT done here; see note below.
 *  6. resolve intersections       - NOT done here; see note below.
 *  7. show uncertainty            - `lowConfidenceElementIds` (never hidden or averaged away).
 *  8. let user correct            - UI concern, out of a data-layer prototype's scope (same as ARQ-170's Apply/Edit/Reject).
 *  9. convert to Arq operations   - one ArqScript wall/door/window command per captured element.
 * 10. validate rooms              - NOT geometry-validated here; see note below.
 * 11. retain source scan provenance - `ConvertedElement.scanObjectId` (RoomPlan's own stable identifier).
 *
 * Steps 5, 6 and 10 (simplify, resolve intersections, validate rooms)
 * need real geometry infrastructure - wall-join resolution
 * (@arq/geometry-2d's t-join.ts and friends), room-boundary tracing
 * (room-boundary-graph.ts) - applied to a whole converted project, which
 * is meaningfully larger scope than "convert a RoomPlan capture to
 * ArqScript commands" and belongs to a later step once real captured
 * data (from real hardware) exists to validate the approach against;
 * building it against synthetic data now risks tuning it to fit made-up
 * numbers rather than a real scan's actual characteristics. Not
 * fabricated as done - each is called out explicitly here and in
 * docs/research/ROOMPLAN-CONVERSION.md.
 *
 * "Arq must not assume that RoomPlan output is a complete editable BIM
 * model" (section 109) is upheld by never silently dropping a captured
 * element that fails to convert (e.g. a degenerate zero-length wall): a
 * per-element failure is collected in `failedElements`, not thrown past
 * this function, and does not prevent the rest of the room from
 * converting - one bad captured surface must not block the whole scan.
 */

import {
  createArqScriptDocument,
  createDoorCommand,
  createWallCommand,
  createWindowCommand,
  type ArqScriptCommand,
  type ArqScriptDocument,
} from '@arq/arqscript';
import type { RoomPlanCapturedRoom, RoomPlanConfidence } from './roomplan-captured-room';

const METRES_TO_MM = 1000;

export function metersToMm(meters: number): number {
  return meters * METRES_TO_MM;
}

export interface ConvertedElement {
  /** RoomPlan's own stable identifier for the captured surface/object - the provenance link (section 109 step 11). */
  readonly scanObjectId: string;
  readonly confidence: RoomPlanConfidence;
  readonly command: ArqScriptCommand;
}

export interface FailedElement {
  readonly scanObjectId: string;
  readonly reason: string;
}

export interface RoomPlanConversionResult {
  readonly document: ArqScriptDocument;
  readonly elements: readonly ConvertedElement[];
  /** Section 109 step 7: elements below 'high' confidence, surfaced explicitly rather than silently trusted the same as the rest. */
  readonly lowConfidenceElementIds: readonly string[];
  /** A captured element that failed to convert (e.g. degenerate geometry) - never silently dropped. */
  readonly failedElements: readonly FailedElement[];
  /** The room's own bounding-box minimum corner, in RoomPlan's original metres, that every converted coordinate was translated by - part of section 109 step 3's "coordinate check", kept visible rather than applied invisibly. */
  readonly originMeters: { readonly xMeters: number; readonly yMeters: number };
}

function isLowConfidence(confidence: RoomPlanConfidence): boolean {
  return confidence !== 'high';
}

/**
 * RoomPlan/ARKit world-space coordinates are relative to wherever the
 * device started scanning, not the room's own geometry - real captures
 * routinely include negative x/y. Finds the room's own bounding-box
 * minimum across every wall endpoint so the caller can translate the
 * whole room to sit at a non-negative origin before building any
 * ArqScript command. Returns (0, 0) for a room with no walls.
 */
function findMinimumCorner(walls: RoomPlanCapturedRoom['walls']): {
  xMeters: number;
  yMeters: number;
} {
  let minX = 0;
  let minY = 0;
  let first = true;
  for (const wall of walls) {
    for (const point of [wall.startMeters, wall.endMeters]) {
      if (first) {
        minX = point.xMeters;
        minY = point.yMeters;
        first = false;
        continue;
      }
      minX = Math.min(minX, point.xMeters);
      minY = Math.min(minY, point.yMeters);
    }
  }
  return { xMeters: minX, yMeters: minY };
}

/** Converts an already-captured RoomPlan room into ArqScript commands. Never throws - a single malformed captured element is recorded in `failedElements`, not allowed to abort the whole conversion. */
export function convertCapturedRoomToArqScript(
  room: RoomPlanCapturedRoom,
  scriptId: string,
): RoomPlanConversionResult {
  const elements: ConvertedElement[] = [];
  const failedElements: FailedElement[] = [];
  const lowConfidenceElementIds: string[] = [];

  const origin = findMinimumCorner(room.walls);

  for (const wall of room.walls) {
    try {
      const command = createWallCommand({
        id: wall.identifier,
        from: {
          xMm: metersToMm(wall.startMeters.xMeters - origin.xMeters),
          yMm: metersToMm(wall.startMeters.yMeters - origin.yMeters),
        },
        to: {
          xMm: metersToMm(wall.endMeters.xMeters - origin.xMeters),
          yMm: metersToMm(wall.endMeters.yMeters - origin.yMeters),
        },
        heightMm: metersToMm(wall.heightMeters),
      });
      elements.push({ scanObjectId: wall.identifier, confidence: wall.confidence, command });
      if (isLowConfidence(wall.confidence)) {
        lowConfidenceElementIds.push(wall.identifier);
      }
    } catch (error) {
      failedElements.push({
        scanObjectId: wall.identifier,
        reason: error instanceof Error ? error.message : 'unknown conversion error',
      });
    }
  }

  for (const opening of room.openings) {
    try {
      const command =
        opening.kind === 'door'
          ? createDoorCommand({
              id: opening.identifier,
              hostWallId: opening.hostWallIdentifier,
              widthMm: metersToMm(opening.widthMeters),
              heightMm: metersToMm(opening.heightMeters),
              offsetMm: metersToMm(opening.offsetMeters),
            })
          : createWindowCommand({
              id: opening.identifier,
              hostWallId: opening.hostWallIdentifier,
              widthMm: metersToMm(opening.widthMeters),
              heightMm: metersToMm(opening.heightMeters),
              offsetMm: metersToMm(opening.offsetMeters),
            });
      elements.push({ scanObjectId: opening.identifier, confidence: opening.confidence, command });
      if (isLowConfidence(opening.confidence)) {
        lowConfidenceElementIds.push(opening.identifier);
      }
    } catch (error) {
      failedElements.push({
        scanObjectId: opening.identifier,
        reason: error instanceof Error ? error.message : 'unknown conversion error',
      });
    }
  }

  const document = createArqScriptDocument({
    version: '0.1',
    scriptId,
    commands: elements.map((element) => element.command),
  });

  return { document, elements, lowConfidenceElementIds, failedElements, originMeters: origin };
}
