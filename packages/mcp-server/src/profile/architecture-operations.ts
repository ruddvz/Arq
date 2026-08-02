/**
 * The argument contracts for the architecture profile's operations, and
 * the ArqScript command each one is produced from.
 *
 * ADR-0014 decided that "AI creates previewable typed operations through
 * ArqScript". @arq/arqscript already implements that grammar: eleven
 * commands, each carrying the `operationType` it will eventually produce.
 * So the operation catalogue this server publishes is not a second,
 * hand-maintained list - the reviewed 2.0 package's integration plan
 * warned against exactly that ("do not hand-maintain a second list in
 * TypeScript") and then shipped one. It is derived from the ArqScript
 * constructors themselves: `ARQSCRIPT_OPERATION_TYPES` is built by calling
 * each constructor once and reading the `operationType` it reports, so a
 * rename inside @arq/arqscript changes this map and fails its test rather
 * than silently leaving the catalogue describing an operation that no
 * longer exists.
 *
 * Wiring the two together surfaced three real gaps between ArqScript v0
 * and the semantic model it has to produce. They are recorded on the
 * operations concerned rather than papered over:
 *
 *   1. ArqScript's `create wall` has no level. `createWall` in
 *      @arq/bim-core requires a `levelId`, so this operation requires one
 *      explicitly. An assistant cannot be allowed to guess which storey a
 *      wall belongs to.
 *   2. ArqScript's wall type is a display name ("Generic 100").
 *      @arq/bim-core needs a `WallTypeId` that resolves to a WallType with
 *      a thickness and a default height, so the operation takes an id and
 *      the profile adds a wall-type creation operation that ArqScript v0
 *      has no command for.
 *   3. ArqScript's `create room` supplies a boundary polygon, while
 *      @arq/bim-core's Room carries a calculated boundary, area and
 *      status. The operation therefore takes the polygon and the host
 *      derives the rest, rather than letting a caller assert an area.
 */

import {
  DEFAULT_DOOR_HEIGHT_MM,
  DEFAULT_DOOR_WIDTH_MM,
  DEFAULT_WALL_HEIGHT_MM,
  DEFAULT_WINDOW_HEIGHT_MM,
  DEFAULT_WINDOW_SILL_HEIGHT_MM,
  DEFAULT_WINDOW_WIDTH_MM,
  createDimensionCommand,
  createDoorCommand,
  createLevelCommand,
  createRenameCommand,
  createRoomCommand,
  createUnitsCommand,
  createUpdateWallCommand,
  createWallCommand,
  createWindowCommand,
} from '@arq/arqscript';
import { boundedText, opaqueId } from '../schema/identifiers';
import {
  arrayValue,
  enumValue,
  integerValue,
  numberValue,
  objectValue,
  refine,
  type Validator,
} from '../schema/schema';

/**
 * The typed-operation names @arq/arqscript actually reports, read from the
 * constructors rather than copied from their source. Every value here is
 * produced by running the real grammar.
 */
export const ARQSCRIPT_OPERATION_TYPES = {
  units: createUnitsCommand('metric').operationType,
  level: createLevelCommand({ name: 'Level 0', elevationMm: 0 }).operationType,
  wall: createWallCommand({
    id: 'w',
    from: { xMm: 0, yMm: 0 },
    to: { xMm: 1000, yMm: 0 },
  }).operationType,
  updateWall: createUpdateWallCommand({ id: 'w', heightMm: DEFAULT_WALL_HEIGHT_MM }).operationType,
  door: createDoorCommand({ id: 'd', hostWallId: 'w', offsetMm: 0 }).operationType,
  window: createWindowCommand({ id: 'n', hostWallId: 'w', offsetMm: 0 }).operationType,
  room: createRoomCommand({
    id: 'r',
    name: 'Room',
    boundary: [
      { xMm: 0, yMm: 0 },
      { xMm: 1000, yMm: 0 },
      { xMm: 1000, yMm: 1000 },
    ],
  }).operationType,
  dimension: createDimensionCommand({
    id: 'dim',
    from: { xMm: 0, yMm: 0 },
    to: { xMm: 1000, yMm: 0 },
  }).operationType,
  rename: createRenameCommand({ id: 'w', newName: 'New' }).operationType,
} as const;

/** The defaults ArqScript records as assumptions, republished so a catalogue reader sees the same numbers the grammar applies. */
export const ARCHITECTURE_DEFAULTS = {
  wallHeightMm: DEFAULT_WALL_HEIGHT_MM,
  doorWidthMm: DEFAULT_DOOR_WIDTH_MM,
  doorHeightMm: DEFAULT_DOOR_HEIGHT_MM,
  windowWidthMm: DEFAULT_WINDOW_WIDTH_MM,
  windowHeightMm: DEFAULT_WINDOW_HEIGHT_MM,
  windowSillHeightMm: DEFAULT_WINDOW_SILL_HEIGHT_MM,
} as const;

/**
 * The plan extends 100 metres in each direction from the origin.
 *
 * A bound is required, not optional: unbounded coordinates are how a
 * proposal turns into a denial-of-service against the geometry kernel and
 * how catastrophic cancellation appears in join maths. ADR-0004 leaves the
 * canonical unit representation open, so this is a proposal-time input
 * guard rather than a claim about internal storage.
 */
export const MAX_PLAN_COORDINATE_MM = 100_000_000;

/** Nothing an assistant proposes may be longer or taller than this. Same reasoning as the coordinate bound. */
export const MAX_ELEMENT_DIMENSION_MM = 1_000_000;

const millimetres = (description: string, maximum = MAX_ELEMENT_DIMENSION_MM): Validator<number> =>
  numberValue({ minimum: 0, maximum, description });

export const planPointArguments = objectValue({
  required: {
    xMm: numberValue({
      minimum: -MAX_PLAN_COORDINATE_MM,
      maximum: MAX_PLAN_COORDINATE_MM,
      description: 'Plan x coordinate in millimetres.',
    }),
    yMm: numberValue({
      minimum: -MAX_PLAN_COORDINATE_MM,
      maximum: MAX_PLAN_COORDINATE_MM,
      description: 'Plan y coordinate in millimetres.',
    }),
  },
  title: 'Plan point',
});

export type PlanPointArguments = { readonly xMm: number; readonly yMm: number };

export const defineUnitsArguments = objectValue({
  required: {
    unit: enumValue(
      ['metric', 'imperial'],
      'The project measurement system, not a per-value unit.',
    ),
  },
  title: 'Define project units',
});

export const createLevelArguments = objectValue({
  required: {
    levelId: opaqueId('Stable identifier for the new level.'),
    name: boundedText(120, 'Level name shown in the model tree.'),
    elevationMm: numberValue({
      minimum: -MAX_PLAN_COORDINATE_MM,
      maximum: MAX_PLAN_COORDINATE_MM,
      description: 'Level elevation in millimetres.',
    }),
  },
  optional: {
    storeyHeightMm: millimetres('Storey height in millimetres, if this level defines one.'),
  },
  title: 'Create level',
});

export const createWallTypeArguments = objectValue({
  required: {
    wallTypeId: opaqueId('Stable identifier for the new wall type.'),
    name: boundedText(120, 'Wall type name, e.g. Generic 100.'),
    thicknessMm: numberValue({
      minimum: 1,
      maximum: MAX_ELEMENT_DIMENSION_MM,
      description: 'Wall thickness in millimetres.',
    }),
    defaultHeightMm: numberValue({
      minimum: 1,
      maximum: MAX_ELEMENT_DIMENSION_MM,
      description: 'Default wall height in millimetres, inherited by walls of this type.',
    }),
  },
  optional: {
    function: enumValue(['exterior', 'interior', 'unknown'], 'Wall function.'),
  },
  title: 'Create wall type',
});

export const createWallArguments = objectValue({
  required: {
    wallId: opaqueId('Stable identifier for the new wall.'),
    // ArqScript v0 has no level in its wall command; @arq/bim-core's
    // createWall requires one. Requiring it here is the honest resolution:
    // the alternative is guessing a storey on the operator's behalf.
    levelId: opaqueId('The level this wall belongs to. ArqScript v0 has no syntax for this.'),
    wallTypeId: opaqueId('A wall type registered in this project.'),
    from: planPointArguments,
    to: planPointArguments,
  },
  optional: {
    heightMm: millimetres(
      `Overrides the wall type's default height. Omitted means the type's height, which ArqScript defaults to ${DEFAULT_WALL_HEIGHT_MM} mm.`,
    ),
    alignment: enumValue(
      ['centre', 'interior', 'exterior'],
      'Which face the reference line follows.',
    ),
  },
  title: 'Create wall',
});

export const updateWallArguments = refine(
  objectValue({
    required: { wallId: opaqueId('The wall to change.') },
    optional: {
      wallTypeId: opaqueId('A different wall type registered in this project.'),
      heightMm: millimetres('A new height override in millimetres.'),
    },
    title: 'Update wall',
  }),
  (value, report) => {
    if (value.wallTypeId === undefined && value.heightMm === undefined) {
      report('$', 'An update must change at least one of wallTypeId or heightMm.');
    }
  },
  'At least one of wallTypeId or heightMm must be present.',
);

export const placeDoorArguments = objectValue({
  required: {
    openingId: opaqueId('Stable identifier for the new door opening.'),
    hostWallId: opaqueId('The wall that hosts this door.'),
    offsetMm: millimetres('Distance along the host wall from its start point.'),
  },
  optional: {
    widthMm: millimetres(`Door width. ArqScript defaults to ${DEFAULT_DOOR_WIDTH_MM} mm.`),
    heightMm: millimetres(`Door height. ArqScript defaults to ${DEFAULT_DOOR_HEIGHT_MM} mm.`),
  },
  title: 'Place door',
});

export const placeWindowArguments = objectValue({
  required: {
    openingId: opaqueId('Stable identifier for the new window opening.'),
    hostWallId: opaqueId('The wall that hosts this window.'),
    offsetMm: millimetres('Distance along the host wall from its start point.'),
  },
  optional: {
    widthMm: millimetres(`Window width. ArqScript defaults to ${DEFAULT_WINDOW_WIDTH_MM} mm.`),
    heightMm: millimetres(`Window height. ArqScript defaults to ${DEFAULT_WINDOW_HEIGHT_MM} mm.`),
    sillHeightMm: millimetres(
      `Sill height above the level. ArqScript defaults to ${DEFAULT_WINDOW_SILL_HEIGHT_MM} mm.`,
    ),
  },
  title: 'Place window',
});

export const createRoomArguments = objectValue({
  required: {
    roomId: opaqueId('Stable identifier for the new room.'),
    levelId: opaqueId('The level this room belongs to.'),
    name: boundedText(120, 'Room name.'),
    boundary: arrayValue(planPointArguments, {
      minItems: 3,
      maxItems: 200,
      description:
        'The room boundary polygon. Arq derives the calculated boundary, area and status from it; a caller may not assert them.',
    }),
  },
  optional: {
    number: boundedText(32, 'Room number.'),
  },
  title: 'Create room',
});

export const addDimensionArguments = objectValue({
  required: {
    dimensionId: opaqueId('Stable identifier for the new dimension.'),
    levelId: opaqueId('The level this dimension is drawn on.'),
    from: planPointArguments,
    to: planPointArguments,
  },
  optional: {
    offsetMm: millimetres('Witness line offset from the measured geometry.'),
    precision: integerValue({ minimum: 0, maximum: 6, description: 'Decimal places shown.' }),
  },
  title: 'Add dimension',
});

export const renameElementArguments = objectValue({
  required: {
    targetId: opaqueId('The level, wall type or room to rename.'),
    newName: boundedText(120, 'The new name.'),
  },
  title: 'Rename',
});

/**
 * Operation type to argument contract.
 *
 * The adapter uses this to check arguments before anything reaches the
 * host, so an argument-shaped mistake is reported as a schema issue with a
 * path rather than as a runtime rejection. The host then narrows by
 * operation type and uses the specific validator above, which is what gives
 * it real types rather than a bag of unknowns.
 */
export const ARCHITECTURE_ARGUMENT_VALIDATORS: Readonly<Record<string, Validator<unknown>>> = {
  'architecture.project.define_units': defineUnitsArguments,
  'architecture.level.create': createLevelArguments,
  'architecture.wall_type.create': createWallTypeArguments,
  'architecture.wall.create': createWallArguments,
  'architecture.wall.update': updateWallArguments,
  'architecture.door.place': placeDoorArguments,
  'architecture.window.place': placeWindowArguments,
  'architecture.room.create': createRoomArguments,
  'architecture.dimension.add': addDimensionArguments,
  'architecture.element.rename': renameElementArguments,
};
