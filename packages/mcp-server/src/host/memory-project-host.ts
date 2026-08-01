/**
 * An in-process Arq host built on the real semantic packages.
 *
 * This is the piece the reviewed MCP System 2.0 package recorded as Blocked
 * on every page: "the actual ARQ repository and runtime contracts were not
 * supplied", so its adapter validated `fixture.record.put` against a map of
 * strings and its capability report said `semantic_geometry: unavailable`.
 * The repository is available here, so the host applies real operations
 * through @arq/bim-core's constructors and rejects them with
 * @arq/validation's and @arq/operations' own rules. A wall shorter than a
 * millimetre is refused by `validateWallSegment`; a room boundary that
 * crosses itself by `validateRoomPolygon`; two openings sharing a span by
 * `validateOpeningOverlaps`. None of those rules is restated here.
 *
 * What this host is not: it is not the `.arq` file, and it does not claim
 * to be. STATUS.md records that no end-to-end project open exists and that
 * `@arq/arqfs` is library-complete but unreachable from the product. So
 * this host holds the semantic model in memory, publication stays a request
 * the operator completes in Arq, and `fileImpact.nativeSchemaChange` on the
 * architecture profile is `false` because nothing here touches a file.
 *
 * Atomicity is structural rather than promised. `runBatch` applies every
 * operation to a clone of the project state; `validate` throws the clone
 * away and reports, `apply` swaps it in only if no operation produced an
 * error. Validation and application therefore run identical code, which is
 * the property that makes "a rejected proposal leaves canonical state
 * unchanged" true by construction rather than by review.
 */

import {
  createLevel,
  createLinearDimension,
  createOpening,
  createRoom,
  createWall,
  createWallType,
  dimensionId as toDimensionId,
  effectiveWallHeight,
  elementId as toElementId,
  explicitPoint,
  length,
  levelId as toLevelId,
  openingFitsWallHeight,
  openingFitsWallLength,
  openingId as toOpeningId,
  roomId as toRoomId,
  toMillimetres,
  wallId as toWallId,
  wallTypeId as toWallTypeId,
  type Level,
  type LinearDimension,
  type Opening,
  type Room,
  type Wall,
  type WallType,
} from '@arq/bim-core';
import { polygonArea, worldPoint, type WorldPoint } from '@arq/geometry-2d';
import { hasErrors, validateOpeningOverlaps, type ValidationMessage } from '@arq/operations';
import {
  validateRoomPolygon,
  validateUniqueElementIds,
  validateWallSegment,
} from '@arq/validation';
import type { JsonValue } from '../schema/json-value';
import type { ProjectAccessState } from '../profile/domain-profile';
import { ARCHITECTURE_OPERATIONS } from '../profile/architecture-profile';
import {
  addDimensionArguments,
  createLevelArguments,
  createRoomArguments,
  createWallArguments,
  createWallTypeArguments,
  defineUnitsArguments,
  placeDoorArguments,
  placeWindowArguments,
  renameElementArguments,
  updateWallArguments,
  type PlanPointArguments,
} from '../profile/architecture-operations';
import type { Validator } from '../schema/schema';
import { formatIssues } from '../schema/schema';
import type {
  ArqOperatorSurface,
  ArqProjectHost,
  HostApplyResult,
  HostOperation,
  HostPrecondition,
  HostProjectSnapshot,
  HostProjectSummary,
  HostQuery,
  HostQueryResult,
  HostSemanticItem,
  HostUndoGroup,
  HostValidationResult,
} from './project-host';

interface UndoGroupRecord {
  readonly undoGroupId: string;
  readonly projectId: string;
  readonly revisionBefore: string;
  readonly revisionAfter: string;
  readonly affectedElementIds: readonly string[];
  readonly operationCount: number;
  readonly restore: ProjectState;
}

interface ProjectState {
  units: 'metric' | 'imperial';
  levels: Map<string, Level>;
  wallTypes: Map<string, WallType>;
  walls: Map<string, Wall>;
  openings: Map<string, Opening>;
  rooms: Map<string, Room>;
  dimensions: Map<string, LinearDimension>;
  versions: Map<string, number>;
}

interface MemoryProject {
  projectId: string;
  name: string;
  revisionCounter: number;
  accessState: ProjectAccessState;
  publishedFileState: 'not_published' | 'published';
  state: ProjectState;
  undoGroups: Map<string, UndoGroupRecord>;
}

export const SEMANTIC_KINDS = {
  level: 'architecture.level',
  wallType: 'architecture.wall_type',
  wall: 'architecture.wall',
  opening: 'architecture.opening',
  room: 'architecture.room',
  dimension: 'architecture.dimension',
} as const;

function emptyState(): ProjectState {
  return {
    units: 'metric',
    levels: new Map(),
    wallTypes: new Map(),
    walls: new Map(),
    openings: new Map(),
    rooms: new Map(),
    dimensions: new Map(),
    versions: new Map(),
  };
}

function cloneState(state: ProjectState): ProjectState {
  // Every value held here is an immutable record produced by a bim-core
  // constructor, so copying the maps is a deep enough copy: nothing shares
  // a mutable object with the original.
  return {
    units: state.units,
    levels: new Map(state.levels),
    wallTypes: new Map(state.wallTypes),
    walls: new Map(state.walls),
    openings: new Map(state.openings),
    rooms: new Map(state.rooms),
    dimensions: new Map(state.dimensions),
    versions: new Map(state.versions),
  };
}

function revisionLabel(counter: number): string {
  return `rev-${counter.toString().padStart(6, '0')}`;
}

function message(
  id: string,
  code: string,
  title: string,
  explanation: string,
  affected: readonly string[],
  suggestedActions: readonly string[],
  severity: ValidationMessage['severity'] = 'error',
): ValidationMessage {
  return {
    id,
    severity,
    code,
    title,
    explanation,
    affectedElementIds: affected.map(toElementId),
    suggestedActions,
  };
}

function point(input: PlanPointArguments): WorldPoint {
  return worldPoint(input.xMm, input.yMm);
}

/** Runs an argument validator and turns a schema failure into the validation vocabulary the rest of Arq speaks. */
function parseArguments<T>(
  validator: Validator<T>,
  operation: HostOperation,
):
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly message: ValidationMessage } {
  const result = validator.validate(operation.arguments, '$.arguments');
  if (result.ok) {
    return { ok: true, value: result.value };
  }
  return {
    ok: false,
    message: message(
      `arguments-invalid-${operation.operationId}`,
      'OPERATION_ARGUMENTS_INVALID',
      'Operation arguments do not match its contract',
      `Operation "${operation.operationId}" (${operation.operationType}) was rejected before it reached the model: ${formatIssues(result.issues)} No change was applied.`,
      [],
      ['Read the operation’s argument schema from the catalogue and rebuild the change set.'],
    ),
  };
}

function elementExists(state: ProjectState, id: string): boolean {
  return (
    state.levels.has(id) ||
    state.wallTypes.has(id) ||
    state.walls.has(id) ||
    state.openings.has(id) ||
    state.rooms.has(id) ||
    state.dimensions.has(id)
  );
}

function bumpVersion(state: ProjectState, id: string): void {
  state.versions.set(id, (state.versions.get(id) ?? 0) + 1);
}

function checkPreconditions(
  state: ProjectState,
  currentRevision: string,
  operation: HostOperation,
): readonly ValidationMessage[] {
  const messages: ValidationMessage[] = [];
  for (const [index, precondition] of operation.preconditions.entries()) {
    const failure = preconditionFailure(state, currentRevision, precondition);
    if (failure !== undefined) {
      messages.push(
        message(
          `precondition-failed-${operation.operationId}-${index}`,
          'PRECONDITION_FAILED',
          'A stated precondition is not true',
          `Operation "${operation.operationId}" expects ${failure} No change was applied.`,
          precondition.kind === 'project.revision_equals' ? [] : [precondition.elementId],
          ['Read the current project snapshot and rebuild the change set against it.'],
        ),
      );
    }
  }
  return messages;
}

function preconditionFailure(
  state: ProjectState,
  currentRevision: string,
  precondition: HostPrecondition,
): string | undefined {
  switch (precondition.kind) {
    case 'project.revision_equals':
      return precondition.revision === currentRevision
        ? undefined
        : `the project to be at revision ${precondition.revision}, but it is at ${currentRevision}.`;
    case 'element.exists':
      return elementExists(state, precondition.elementId)
        ? undefined
        : `element "${precondition.elementId}" to exist, and it does not.`;
    case 'element.absent':
      return elementExists(state, precondition.elementId)
        ? `element "${precondition.elementId}" to be absent, and it already exists.`
        : undefined;
    case 'element.version_equals': {
      const actual = state.versions.get(precondition.elementId);
      return actual === precondition.version
        ? undefined
        : `element "${precondition.elementId}" to be at version ${precondition.version}, but it is at ${actual ?? 'absent'}.`;
    }
  }
}

interface BatchOutcome {
  readonly state: ProjectState;
  readonly messages: readonly ValidationMessage[];
  readonly affectedElementIds: readonly string[];
  readonly failedOperationId?: string;
}

/**
 * Applies a batch to a clone and reports what happened.
 *
 * The batch stops at the first operation that produces an error, because
 * everything after it would be validated against a state that will never
 * exist. The identifier of that operation is reported so a reviewer sees
 * which one broke rather than having to diff the message list.
 */
function runBatch(project: MemoryProject, operations: readonly HostOperation[]): BatchOutcome {
  const state = cloneState(project.state);
  const messages: ValidationMessage[] = [];
  const affected = new Set<string>();
  const currentRevision = revisionLabel(project.revisionCounter);
  let failedOperationId: string | undefined;

  for (const operation of operations) {
    const preconditionMessages = checkPreconditions(state, currentRevision, operation);
    if (preconditionMessages.length > 0) {
      messages.push(...preconditionMessages);
      failedOperationId = operation.operationId;
      break;
    }

    const outcome = applyOne(state, operation);
    messages.push(...outcome.messages);
    for (const id of outcome.affected) {
      affected.add(id);
    }
    if (hasErrors(outcome.messages)) {
      failedOperationId = operation.operationId;
      break;
    }
  }

  // Identity is a whole-project rule, so it is checked once over the
  // finished candidate rather than per operation.
  if (failedOperationId === undefined) {
    messages.push(...validateUniqueElementIds([...state.versions.keys()]));
  }

  return {
    state,
    messages,
    affectedElementIds: [...affected].sort(),
    ...(failedOperationId === undefined ? {} : { failedOperationId }),
  };
}

interface OperationOutcome {
  readonly messages: readonly ValidationMessage[];
  readonly affected: readonly string[];
}

function applyOne(state: ProjectState, operation: HostOperation): OperationOutcome {
  switch (operation.operationType) {
    case 'architecture.project.define_units':
      return applyDefineUnits(state, operation);
    case 'architecture.level.create':
      return applyCreateLevel(state, operation);
    case 'architecture.wall_type.create':
      return applyCreateWallType(state, operation);
    case 'architecture.wall.create':
      return applyCreateWall(state, operation);
    case 'architecture.wall.update':
      return applyUpdateWall(state, operation);
    case 'architecture.door.place':
      return applyPlaceOpening(state, operation, 'door');
    case 'architecture.window.place':
      return applyPlaceOpening(state, operation, 'window');
    case 'architecture.room.create':
      return applyCreateRoom(state, operation);
    case 'architecture.dimension.add':
      return applyAddDimension(state, operation);
    case 'architecture.element.rename':
      return applyRename(state, operation);
    default:
      return {
        affected: [],
        messages: [
          message(
            `operation-unregistered-${operation.operationId}`,
            'OPERATION_UNREGISTERED',
            'Operation is not registered',
            `This host has no implementation for "${operation.operationType}". No change was applied.`,
            [],
            ['Read the operation catalogue and use a registered operation type and version.'],
          ),
        ],
      };
  }
}

function duplicateId(operation: HostOperation, id: string): ValidationMessage {
  return message(
    `duplicate-id-${operation.operationId}`,
    'ELEMENT_ID_IN_USE',
    'That identifier is already in use',
    `"${id}" already names an element in this project. Element identifiers must be unique, or selection and undo become ambiguous. No change was applied.`,
    [id],
    ['Choose a fresh identifier for the new element.'],
  );
}

function missingReference(
  operation: HostOperation,
  what: string,
  id: string,
  action: string,
): ValidationMessage {
  return message(
    `missing-${what}-${operation.operationId}`,
    'REFERENCE_NOT_FOUND',
    `That ${what} does not exist`,
    `Operation "${operation.operationId}" refers to ${what} "${id}", which is not in this project. No change was applied.`,
    [id],
    [action],
  );
}

/** bim-core constructors throw RangeError on genuinely invalid input. Catching it keeps a bad argument a validation result rather than a crashed request. */
function constructed<T>(
  operation: HostOperation,
  build: () => T,
):
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly message: ValidationMessage } {
  try {
    return { ok: true, value: build() };
  } catch (error) {
    return {
      ok: false,
      message: message(
        `construction-rejected-${operation.operationId}`,
        'MODEL_REJECTED_VALUE',
        'The model rejected a value',
        `Operation "${operation.operationId}" was rejected by the semantic model: ${error instanceof Error ? error.message : String(error)}. No change was applied.`,
        [],
        ['Correct the value and stage a new change set.'],
      ),
    };
  }
}

function applyDefineUnits(state: ProjectState, operation: HostOperation): OperationOutcome {
  const parsed = parseArguments(defineUnitsArguments, operation);
  if (!parsed.ok) {
    return { messages: [parsed.message], affected: [] };
  }
  state.units = parsed.value.unit;
  return { messages: [], affected: [] };
}

function applyCreateLevel(state: ProjectState, operation: HostOperation): OperationOutcome {
  const parsed = parseArguments(createLevelArguments, operation);
  if (!parsed.ok) {
    return { messages: [parsed.message], affected: [] };
  }
  const { levelId, name, elevationMm, storeyHeightMm } = parsed.value;
  if (elementExists(state, levelId)) {
    return { messages: [duplicateId(operation, levelId)], affected: [levelId] };
  }
  const built = constructed(operation, () =>
    createLevel({
      id: toLevelId(levelId),
      name,
      elevation: elevationMm,
      ...(storeyHeightMm === undefined ? {} : { storeyHeight: storeyHeightMm }),
    }),
  );
  if (!built.ok) {
    return { messages: [built.message], affected: [levelId] };
  }
  state.levels.set(levelId, built.value);
  bumpVersion(state, levelId);
  return { messages: [], affected: [levelId] };
}

function applyCreateWallType(state: ProjectState, operation: HostOperation): OperationOutcome {
  const parsed = parseArguments(createWallTypeArguments, operation);
  if (!parsed.ok) {
    return { messages: [parsed.message], affected: [] };
  }
  const { wallTypeId, name, thicknessMm, defaultHeightMm } = parsed.value;
  if (elementExists(state, wallTypeId)) {
    return { messages: [duplicateId(operation, wallTypeId)], affected: [wallTypeId] };
  }
  const built = constructed(operation, () =>
    createWallType({
      id: toWallTypeId(wallTypeId),
      name,
      thickness: length(thicknessMm, 'mm'),
      defaultHeight: length(defaultHeightMm, 'mm'),
      ...(parsed.value.function === undefined ? {} : { function: parsed.value.function }),
    }),
  );
  if (!built.ok) {
    return { messages: [built.message], affected: [wallTypeId] };
  }
  state.wallTypes.set(wallTypeId, built.value);
  bumpVersion(state, wallTypeId);
  return { messages: [], affected: [wallTypeId] };
}

function applyCreateWall(state: ProjectState, operation: HostOperation): OperationOutcome {
  const parsed = parseArguments(createWallArguments, operation);
  if (!parsed.ok) {
    return { messages: [parsed.message], affected: [] };
  }
  const { wallId, levelId, wallTypeId, from, to, heightMm, alignment } = parsed.value;
  if (elementExists(state, wallId)) {
    return { messages: [duplicateId(operation, wallId)], affected: [wallId] };
  }
  if (!state.levels.has(levelId)) {
    return {
      messages: [
        missingReference(
          operation,
          'level',
          levelId,
          'Create the level first, or name an existing one.',
        ),
      ],
      affected: [wallId],
    };
  }
  if (!state.wallTypes.has(wallTypeId)) {
    return {
      messages: [
        missingReference(
          operation,
          'wall type',
          wallTypeId,
          'Create the wall type first, or name an existing one.',
        ),
      ],
      affected: [wallId],
    };
  }

  const start = point(from);
  const end = point(to);
  // @arq/validation owns the geometry rule. Restating "a wall must be at
  // least a millimetre long" here would create a second answer to the same
  // question.
  const geometry = validateWallSegment({ id: wallId, start, end });
  if (hasErrors(geometry)) {
    return { messages: geometry, affected: [wallId] };
  }

  const built = constructed(operation, () =>
    createWall({
      id: toWallId(wallId),
      typeId: toWallTypeId(wallTypeId),
      levelId: toLevelId(levelId),
      start,
      end,
      ...(alignment === undefined ? {} : { alignment }),
      ...(heightMm === undefined ? {} : { heightOverride: length(heightMm, 'mm') }),
    }),
  );
  if (!built.ok) {
    return { messages: [built.message], affected: [wallId] };
  }

  const duplicateWarnings = duplicateGeometryWarnings(state, wallId, start, end);
  state.walls.set(wallId, built.value);
  bumpVersion(state, wallId);
  return { messages: [...geometry, ...duplicateWarnings], affected: [wallId] };
}

/** A wall that exactly repeats another is legal but almost never intended, so it is reported as a warning rather than blocked. */
function duplicateGeometryWarnings(
  state: ProjectState,
  wallId: string,
  start: WorldPoint,
  end: WorldPoint,
): readonly ValidationMessage[] {
  const key = geometryKey(start, end);
  for (const existing of state.walls.values()) {
    if (geometryKey(existing.start, existing.end) === key) {
      return [
        message(
          `wall-duplicate-${wallId}`,
          'WALL_DUPLICATE_GEOMETRY',
          'Wall duplicates an existing wall',
          `Wall "${wallId}" has exactly the same start and end as wall "${existing.id}". Both walls will exist; the duplicate may be unintended.`,
          [wallId, existing.id],
          ['Remove one of the two walls if the duplication was unintended.'],
          'warning',
        ),
      ];
    }
  }
  return [];
}

function geometryKey(start: WorldPoint, end: WorldPoint): string {
  const forward = `${start.x},${start.y}|${end.x},${end.y}`;
  const backward = `${end.x},${end.y}|${start.x},${start.y}`;
  return forward < backward ? forward : backward;
}

function applyUpdateWall(state: ProjectState, operation: HostOperation): OperationOutcome {
  const parsed = parseArguments(updateWallArguments, operation);
  if (!parsed.ok) {
    return { messages: [parsed.message], affected: [] };
  }
  const { wallId, wallTypeId, heightMm } = parsed.value;
  const wall = state.walls.get(wallId);
  if (wall === undefined) {
    return {
      messages: [
        missingReference(operation, 'wall', wallId, 'Name a wall that exists in this project.'),
      ],
      affected: [wallId],
    };
  }
  if (wallTypeId !== undefined && !state.wallTypes.has(wallTypeId)) {
    return {
      messages: [
        missingReference(
          operation,
          'wall type',
          wallTypeId,
          'Name a wall type that exists in this project.',
        ),
      ],
      affected: [wallId],
    };
  }

  const updated: Wall = {
    ...wall,
    ...(wallTypeId === undefined ? {} : { typeId: toWallTypeId(wallTypeId) }),
    ...(heightMm === undefined ? {} : { heightOverride: length(heightMm, 'mm') }),
  };
  state.walls.set(wallId, updated);
  bumpVersion(state, wallId);

  // Changing a wall's height or type can invalidate an opening that used to
  // fit. Reporting it here, at the operation that caused it, is what makes
  // the impact list in the review honest.
  const affected = [wallId];
  const messages: ValidationMessage[] = [];
  for (const openingId of updated.hostedOpeningIds) {
    const opening = state.openings.get(openingId);
    const wallType = state.wallTypes.get(updated.typeId);
    if (opening === undefined || wallType === undefined) {
      continue;
    }
    affected.push(openingId);
    if (!openingFitsWallHeight(opening, updated, wallType)) {
      messages.push(
        message(
          `opening-no-longer-fits-${openingId}`,
          'OPENING_EXCEEDS_HOST_HEIGHT',
          'An opening no longer fits its wall',
          `Opening "${openingId}" is taller than wall "${wallId}" would be after this change (${toMillimetres(effectiveWallHeight(updated, wallType))} mm). No change was applied.`,
          [openingId, wallId],
          ['Lower the opening, or choose a height that still contains it.'],
        ),
      );
    }
  }
  return { messages, affected };
}

function applyPlaceOpening(
  state: ProjectState,
  operation: HostOperation,
  kind: 'door' | 'window',
): OperationOutcome {
  // Doors and windows differ by exactly one argument, so they are parsed
  // separately and then normalised. Narrowing a union of the two shapes
  // afterwards would leave `sillHeightMm` untyped for no benefit.
  let value: {
    readonly openingId: string;
    readonly hostWallId: string;
    readonly offsetMm: number;
    readonly widthMm?: number;
    readonly heightMm?: number;
    readonly sillHeightMm?: number;
  };
  if (kind === 'door') {
    const parsed = parseArguments(placeDoorArguments, operation);
    if (!parsed.ok) {
      return { messages: [parsed.message], affected: [] };
    }
    value = parsed.value;
  } else {
    const parsed = parseArguments(placeWindowArguments, operation);
    if (!parsed.ok) {
      return { messages: [parsed.message], affected: [] };
    }
    value = parsed.value;
  }

  const openingId = value.openingId;
  const hostWallId = value.hostWallId;
  const sillHeightMm = value.sillHeightMm;

  if (elementExists(state, openingId)) {
    return { messages: [duplicateId(operation, openingId)], affected: [openingId] };
  }
  const wall = state.walls.get(hostWallId);
  if (wall === undefined) {
    return {
      messages: [
        missingReference(
          operation,
          'wall',
          hostWallId,
          'Create the wall first, or name an existing one.',
        ),
      ],
      affected: [openingId],
    };
  }
  const wallType = state.wallTypes.get(wall.typeId);
  if (wallType === undefined) {
    return {
      messages: [
        missingReference(
          operation,
          'wall type',
          wall.typeId,
          'The host wall names a wall type that is not in this project. Repair the wall before hosting an opening in it.',
        ),
      ],
      affected: [openingId, hostWallId],
    };
  }

  const defaults = defaultsFor(kind);
  const built = constructed(operation, () =>
    createOpening({
      id: toOpeningId(openingId),
      hostWallId: toWallId(hostWallId),
      kind,
      offsetFromWallStart: length(value.offsetMm, 'mm'),
      width: length(value.widthMm ?? defaults.widthMm, 'mm'),
      height: length(value.heightMm ?? defaults.heightMm, 'mm'),
      sillHeight: length(sillHeightMm ?? defaults.sillHeightMm, 'mm'),
    }),
  );
  if (!built.ok) {
    return { messages: [built.message], affected: [openingId] };
  }

  const opening = built.value;
  const messages: ValidationMessage[] = [];
  if (!openingFitsWallLength(opening, wall)) {
    messages.push(
      message(
        `opening-exceeds-length-${openingId}`,
        'OPENING_EXCEEDS_HOST_LENGTH',
        'The opening extends past its wall',
        `Opening "${openingId}" would run past the end of wall "${hostWallId}". No change was applied.`,
        [openingId, hostWallId],
        ['Move the opening along the wall, or make it narrower.'],
      ),
    );
  }
  if (!openingFitsWallHeight(opening, wall, wallType)) {
    messages.push(
      message(
        `opening-exceeds-height-${openingId}`,
        'OPENING_EXCEEDS_HOST_HEIGHT',
        'The opening is taller than its wall',
        `Opening "${openingId}" plus its sill is taller than wall "${hostWallId}" (${toMillimetres(effectiveWallHeight(wall, wallType))} mm). No change was applied.`,
        [openingId, hostWallId],
        ['Lower the sill, reduce the height, or use a taller wall.'],
      ),
    );
  }

  const siblings = [...state.openings.values()].filter(
    (candidate) => candidate.hostWallId === wall.id,
  );
  // @arq/operations owns "overlaps are blocking by default"; this call is
  // the whole rule, not a reimplementation of it.
  messages.push(...validateOpeningOverlaps([...siblings, opening]));
  if (hasErrors(messages)) {
    return { messages, affected: [openingId, hostWallId] };
  }

  state.openings.set(openingId, opening);
  state.walls.set(hostWallId, {
    ...wall,
    hostedOpeningIds: [...wall.hostedOpeningIds, toOpeningId(openingId)],
  });
  bumpVersion(state, openingId);
  bumpVersion(state, hostWallId);
  return { messages, affected: [openingId, hostWallId] };
}

function defaultsFor(kind: 'door' | 'window'): {
  readonly widthMm: number;
  readonly heightMm: number;
  readonly sillHeightMm: number;
} {
  return kind === 'door'
    ? { widthMm: 900, heightMm: 2100, sillHeightMm: 0 }
    : { widthMm: 1200, heightMm: 1200, sillHeightMm: 900 };
}

function applyCreateRoom(state: ProjectState, operation: HostOperation): OperationOutcome {
  const parsed = parseArguments(createRoomArguments, operation);
  if (!parsed.ok) {
    return { messages: [parsed.message], affected: [] };
  }
  const { roomId, levelId, name, boundary, number } = parsed.value;
  if (elementExists(state, roomId)) {
    return { messages: [duplicateId(operation, roomId)], affected: [roomId] };
  }
  if (!state.levels.has(levelId)) {
    return {
      messages: [
        missingReference(
          operation,
          'level',
          levelId,
          'Create the level first, or name an existing one.',
        ),
      ],
      affected: [roomId],
    };
  }

  const points = boundary.map(point);
  const polygon = validateRoomPolygon(roomId, points);
  if (hasErrors(polygon)) {
    return { messages: polygon, affected: [roomId] };
  }

  // The caller supplies the boundary; Arq derives the area and the status.
  // Letting a caller assert an area would make the model's own answer
  // negotiable.
  const built = constructed(operation, () =>
    createRoom({
      id: toRoomId(roomId),
      levelId: toLevelId(levelId),
      seedPoint: centroid(points),
      name,
      boundaryElementIds: [],
      calculatedBoundary: points,
      calculatedArea: Math.abs(polygonArea(points)),
      status: 'valid',
      ...(number === undefined ? {} : { number }),
    }),
  );
  if (!built.ok) {
    return { messages: [built.message], affected: [roomId] };
  }
  state.rooms.set(roomId, built.value);
  bumpVersion(state, roomId);
  return { messages: polygon, affected: [roomId] };
}

function centroid(points: readonly WorldPoint[]): WorldPoint {
  const sum = points.reduce(
    (accumulator, current) => ({ x: accumulator.x + current.x, y: accumulator.y + current.y }),
    { x: 0, y: 0 },
  );
  return worldPoint(sum.x / points.length, sum.y / points.length);
}

function applyAddDimension(state: ProjectState, operation: HostOperation): OperationOutcome {
  const parsed = parseArguments(addDimensionArguments, operation);
  if (!parsed.ok) {
    return { messages: [parsed.message], affected: [] };
  }
  const { dimensionId, levelId, from, to, offsetMm, precision } = parsed.value;
  if (elementExists(state, dimensionId)) {
    return { messages: [duplicateId(operation, dimensionId)], affected: [dimensionId] };
  }
  if (!state.levels.has(levelId)) {
    return {
      messages: [
        missingReference(
          operation,
          'level',
          levelId,
          'Create the level first, or name an existing one.',
        ),
      ],
      affected: [dimensionId],
    };
  }
  const built = constructed(operation, () =>
    createLinearDimension({
      id: toDimensionId(dimensionId),
      levelId: toLevelId(levelId),
      start: explicitPoint(point(from)),
      end: explicitPoint(point(to)),
      offset: length(offsetMm ?? 0, 'mm'),
      ...(precision === undefined ? {} : { precision }),
    }),
  );
  if (!built.ok) {
    return { messages: [built.message], affected: [dimensionId] };
  }
  state.dimensions.set(dimensionId, built.value);
  bumpVersion(state, dimensionId);
  return { messages: [], affected: [dimensionId] };
}

function applyRename(state: ProjectState, operation: HostOperation): OperationOutcome {
  const parsed = parseArguments(renameElementArguments, operation);
  if (!parsed.ok) {
    return { messages: [parsed.message], affected: [] };
  }
  const { targetId, newName } = parsed.value;

  const level = state.levels.get(targetId);
  if (level !== undefined) {
    state.levels.set(targetId, { ...level, name: newName });
    bumpVersion(state, targetId);
    return { messages: [], affected: [targetId] };
  }
  const wallType = state.wallTypes.get(targetId);
  if (wallType !== undefined) {
    state.wallTypes.set(targetId, { ...wallType, name: newName });
    bumpVersion(state, targetId);
    return { messages: [], affected: [targetId] };
  }
  const room = state.rooms.get(targetId);
  if (room !== undefined) {
    state.rooms.set(targetId, { ...room, name: newName });
    bumpVersion(state, targetId);
    return { messages: [], affected: [targetId] };
  }

  return {
    affected: [targetId],
    messages: [
      message(
        `rename-target-missing-${operation.operationId}`,
        'RENAME_TARGET_NOT_NAMEABLE',
        'That element has no name to change',
        `"${targetId}" is not a level, wall type or room in this project. Walls, openings and dimensions carry no name of their own. No change was applied.`,
        [targetId],
        ['Rename a level, a wall type or a room instead.'],
      ),
    ],
  };
}

function invalidationsFor(operations: readonly HostOperation[]): readonly string[] {
  const outputs = new Set<string>();
  for (const operation of operations) {
    const definition = ARCHITECTURE_OPERATIONS.find(
      (candidate) => candidate.operationType === operation.operationType,
    );
    for (const invalidation of definition?.knownInvalidations ?? []) {
      outputs.add(invalidation);
    }
  }
  return [...outputs].sort();
}

function previewsFor(operations: readonly HostOperation[]): readonly string[] {
  const previews = new Set<string>();
  for (const operation of operations) {
    const definition = ARCHITECTURE_OPERATIONS.find(
      (candidate) => candidate.operationType === operation.operationType,
    );
    for (const preview of definition?.previewKinds ?? []) {
      previews.add(preview);
    }
  }
  return [...previews].sort();
}

function toSemanticItems(state: ProjectState): readonly HostSemanticItem[] {
  const items: HostSemanticItem[] = [];
  const version = (id: string): number => state.versions.get(id) ?? 0;

  for (const level of state.levels.values()) {
    items.push({
      id: level.id,
      kind: SEMANTIC_KINDS.level,
      version: version(level.id),
      data: {
        levelId: level.id,
        name: level.name,
        elevationMm: level.elevation,
        ...(level.storeyHeight === undefined ? {} : { storeyHeightMm: level.storeyHeight }),
      },
    });
  }
  for (const wallType of state.wallTypes.values()) {
    items.push({
      id: wallType.id,
      kind: SEMANTIC_KINDS.wallType,
      version: version(wallType.id),
      data: {
        wallTypeId: wallType.id,
        name: wallType.name,
        thicknessMm: toMillimetres(wallType.thickness),
        defaultHeightMm: toMillimetres(wallType.defaultHeight),
        function: wallType.function,
      },
    });
  }
  for (const wall of state.walls.values()) {
    const wallType = state.wallTypes.get(wall.typeId);
    items.push({
      id: wall.id,
      kind: SEMANTIC_KINDS.wall,
      version: version(wall.id),
      data: {
        wallId: wall.id,
        levelId: wall.levelId,
        wallTypeId: wall.typeId,
        startXMm: wall.start.x,
        startYMm: wall.start.y,
        endXMm: wall.end.x,
        endYMm: wall.end.y,
        alignment: wall.alignment,
        hostedOpeningIds: [...wall.hostedOpeningIds],
        ...(wallType === undefined
          ? {}
          : { effectiveHeightMm: toMillimetres(effectiveWallHeight(wall, wallType)) }),
        heightIsOverridden: wall.heightOverride !== undefined,
      },
    });
  }
  for (const opening of state.openings.values()) {
    items.push({
      id: opening.id,
      kind: SEMANTIC_KINDS.opening,
      version: version(opening.id),
      data: {
        openingId: opening.id,
        hostWallId: opening.hostWallId,
        openingKind: opening.kind,
        offsetMm: toMillimetres(opening.offsetFromWallStart),
        widthMm: toMillimetres(opening.width),
        heightMm: toMillimetres(opening.height),
        sillHeightMm: toMillimetres(opening.sillHeight),
      },
    });
  }
  for (const room of state.rooms.values()) {
    items.push({
      id: room.id,
      kind: SEMANTIC_KINDS.room,
      version: version(room.id),
      data: {
        roomId: room.id,
        levelId: room.levelId,
        name: room.name,
        calculatedAreaMm2: room.calculatedArea,
        status: room.status,
        boundaryPointCount: room.calculatedBoundary.length,
        ...(room.number === undefined ? {} : { number: room.number }),
      },
    });
  }
  for (const dimension of state.dimensions.values()) {
    items.push({
      id: dimension.id,
      kind: SEMANTIC_KINDS.dimension,
      version: version(dimension.id),
      data: {
        dimensionId: dimension.id,
        levelId: dimension.levelId,
        offsetMm: toMillimetres(dimension.offset),
        precision: dimension.precision,
      },
    });
  }
  return items.sort((left, right) => left.id.localeCompare(right.id));
}

export interface MemoryHostBundle {
  /** What the MCP adapter receives. It can read and validate, and it has no method that changes anything. */
  readonly host: ArqProjectHost;
  /** What the Arq application receives. Every method here corresponds to something a person did in Arq. */
  readonly operator: ArqOperatorSurface;
}

export interface MemoryHostOptions {
  /** When false, `requestOpen` reports `runtime_unavailable` - the honest answer when no Arq window is listening. */
  readonly applicationRunning?: boolean;
}

export function createMemoryArqHost(options: MemoryHostOptions = {}): MemoryHostBundle {
  const projects = new Map<string, MemoryProject>();
  const applicationRunning = options.applicationRunning ?? true;

  const summaryOf = (project: MemoryProject): HostProjectSummary => ({
    projectId: project.projectId,
    name: project.name,
    revision: revisionLabel(project.revisionCounter),
    accessState: project.accessState,
    workingCopyState: 'application_managed',
    publishedFileState: project.publishedFileState,
  });

  const host: ArqProjectHost = {
    listProjectIds() {
      return [...projects.keys()].sort();
    },
    getSummary(projectId) {
      const project = projects.get(projectId);
      return project === undefined ? undefined : summaryOf(project);
    },
    getSnapshot(projectId) {
      const project = projects.get(projectId);
      if (project === undefined) {
        return undefined;
      }
      const counts: Record<string, number> = {
        [SEMANTIC_KINDS.level]: project.state.levels.size,
        [SEMANTIC_KINDS.wallType]: project.state.wallTypes.size,
        [SEMANTIC_KINDS.wall]: project.state.walls.size,
        [SEMANTIC_KINDS.opening]: project.state.openings.size,
        [SEMANTIC_KINDS.room]: project.state.rooms.size,
        [SEMANTIC_KINDS.dimension]: project.state.dimensions.size,
      };
      const snapshot: HostProjectSnapshot = {
        summary: summaryOf(project),
        semanticCounts: counts,
        staleOutputs: [],
        warnings: [
          'This project is held in memory by the Arq host. It is not a .arq file, and no file has been written.',
        ],
      };
      return snapshot;
    },
    query(query) {
      const project = projects.get(query.projectId);
      if (project === undefined) {
        return undefined;
      }
      const revision = revisionLabel(project.revisionCounter);
      if (revision !== query.snapshotRevision) {
        return undefined;
      }

      const idFilter = query.ids === undefined ? undefined : new Set(query.ids);
      const kindFilter = query.kinds === undefined ? undefined : new Set(query.kinds);
      // `toLowerCase`, not `toLocaleLowerCase`: a locale-sensitive fold makes
      // the same query return different results on a Turkish host, and this
      // repository treats determinism across platforms as a requirement.
      const search = query.text?.toLowerCase();
      const fields = query.fields === undefined ? undefined : new Set(query.fields);

      const matched = toSemanticItems(project.state).filter((item) => {
        if (idFilter !== undefined && !idFilter.has(item.id)) {
          return false;
        }
        if (kindFilter !== undefined && !kindFilter.has(item.kind)) {
          return false;
        }
        if (search === undefined) {
          return true;
        }
        return (
          item.id.toLowerCase().includes(search) ||
          Object.values(item.data).some(
            (value) => typeof value === 'string' && value.toLowerCase().includes(search),
          )
        );
      });

      const page = matched.slice(query.offset, query.offset + query.limit).map((item) => {
        if (fields === undefined) {
          return item;
        }
        const data: Record<string, JsonValue> = {};
        for (const [key, value] of Object.entries(item.data)) {
          if (fields.has(key)) {
            data[key] = value;
          }
        }
        return { ...item, data };
      });

      const result: HostQueryResult = {
        snapshotRevision: revision,
        items: page,
        totalMatches: matched.length,
      };
      return result;
    },
    validate(projectId, baseRevision, operations) {
      const project = projects.get(projectId);
      if (project === undefined) {
        return {
          status: 'failed',
          messages: [
            message(
              'project-missing',
              'PROJECT_NOT_AVAILABLE',
              'That project is not available',
              'No change was applied.',
              [],
              ['List the granted projects and use one of those identifiers.'],
            ),
          ],
          affectedElementIds: [],
          expectedInvalidations: [],
          availablePreviews: [],
        };
      }
      const currentRevision = revisionLabel(project.revisionCounter);
      if (currentRevision !== baseRevision) {
        return {
          status: 'failed',
          messages: [
            message(
              'revision-stale',
              'BASE_REVISION_STALE',
              'The project has moved on',
              `This change was built against ${baseRevision}, and the project is at ${currentRevision}. No change was applied.`,
              [],
              ['Read the current snapshot and rebuild the change set against it.'],
            ),
          ],
          affectedElementIds: [],
          expectedInvalidations: [],
          availablePreviews: [],
        };
      }

      const outcome = runBatch(project, operations);
      const failed = hasErrors(outcome.messages);
      return {
        status: failed ? 'failed' : 'passed',
        messages: outcome.messages,
        affectedElementIds: outcome.affectedElementIds,
        expectedInvalidations: failed ? [] : invalidationsFor(operations),
        availablePreviews: failed ? [] : previewsFor(operations),
        ...(outcome.failedOperationId === undefined
          ? {}
          : { failedOperationId: outcome.failedOperationId }),
      };
    },
    createDraft(projectId, name) {
      const existing = projects.get(projectId);
      if (existing !== undefined) {
        return summaryOf(existing);
      }
      const project: MemoryProject = {
        projectId,
        name,
        revisionCounter: 0,
        accessState: 'editable',
        publishedFileState: 'not_published',
        state: emptyState(),
        undoGroups: new Map(),
      };
      projects.set(projectId, project);
      return summaryOf(project);
    },
    requestOpen(projectId) {
      if (!applicationRunning || !projects.has(projectId)) {
        return 'runtime_unavailable';
      }
      return 'project_open_requested';
    },
    getUndoGroup(projectId, undoGroupId) {
      const project = projects.get(projectId);
      const group = project?.undoGroups.get(undoGroupId);
      if (project === undefined || group === undefined) {
        return undefined;
      }
      const undoGroup: HostUndoGroup = {
        undoGroupId: group.undoGroupId,
        projectId: group.projectId,
        revisionBefore: group.revisionBefore,
        revisionAfter: group.revisionAfter,
        affectedElementIds: group.affectedElementIds,
        operationCount: group.operationCount,
        hasDownstreamChanges: revisionLabel(project.revisionCounter) !== group.revisionAfter,
      };
      return undoGroup;
    },
  };

  const operator: ArqOperatorSurface = {
    apply(projectId, baseRevision, operations, actorId) {
      const project = projects.get(projectId);
      if (project === undefined) {
        return {
          status: 'rejected',
          revisionBefore: baseRevision,
          messages: [
            message(
              'project-missing',
              'PROJECT_NOT_AVAILABLE',
              'That project is not available',
              'No change was applied.',
              [],
              ['List the granted projects and use one of those identifiers.'],
            ),
          ],
          affectedElementIds: [],
        };
      }

      const revisionBefore = revisionLabel(project.revisionCounter);
      // Revalidation at commit time, not a replay of the staging verdict.
      // The interesting failure is the one that appeared between the two.
      const revalidated = host.validate(projectId, baseRevision, operations);
      if (revalidated.status === 'failed') {
        return {
          status: 'rejected',
          revisionBefore,
          messages: revalidated.messages,
          affectedElementIds: revalidated.affectedElementIds,
        };
      }

      const outcome = runBatch(project, operations);
      if (hasErrors(outcome.messages)) {
        return {
          status: 'rejected',
          revisionBefore,
          messages: outcome.messages,
          affectedElementIds: outcome.affectedElementIds,
        };
      }

      const restore = project.state;
      project.state = outcome.state;
      project.revisionCounter += 1;
      const revisionAfter = revisionLabel(project.revisionCounter);
      const undoGroupId = `undo-${projectId}-${revisionAfter}`;
      project.undoGroups.set(undoGroupId, {
        undoGroupId,
        projectId,
        revisionBefore,
        revisionAfter,
        affectedElementIds: outcome.affectedElementIds,
        operationCount: operations.length,
        restore,
      });
      void actorId;

      const applied: HostApplyResult = {
        status: 'applied',
        revisionBefore,
        revisionAfter,
        undoGroupId,
        messages: outcome.messages,
        affectedElementIds: outcome.affectedElementIds,
      };
      return applied;
    },
    undo(projectId, undoGroupId) {
      const project = projects.get(projectId);
      const group = project?.undoGroups.get(undoGroupId);
      if (project === undefined || group === undefined) {
        return {
          status: 'rejected',
          revisionBefore: 'unknown',
          messages: [
            message(
              'undo-group-missing',
              'UNDO_GROUP_NOT_AVAILABLE',
              'That undo group is not available',
              'No change was applied.',
              [],
              ['Read the project history for a group this project actually has.'],
            ),
          ],
          affectedElementIds: [],
        };
      }

      const revisionBefore = revisionLabel(project.revisionCounter);
      if (revisionBefore !== group.revisionAfter) {
        // Later work sits on top of this group. Undoing it blind would
        // silently discard that work, so Arq has to reconcile first.
        return {
          status: 'rejected',
          revisionBefore,
          messages: [
            message(
              'undo-has-downstream',
              'UNDO_HAS_DOWNSTREAM_CHANGES',
              'Later changes depend on this one',
              `The project moved from ${group.revisionAfter} to ${revisionBefore} after this group. Arq must reconcile the later work before this group can be undone. No change was applied.`,
              [...group.affectedElementIds],
              ['Undo the later changes first, or ask Arq to reconcile them.'],
            ),
          ],
          affectedElementIds: group.affectedElementIds,
        };
      }

      project.state = group.restore;
      project.revisionCounter += 1;
      project.undoGroups.delete(undoGroupId);
      return {
        status: 'applied',
        revisionBefore,
        revisionAfter: revisionLabel(project.revisionCounter),
        messages: [],
        affectedElementIds: group.affectedElementIds,
      };
    },
    setAccessState(projectId, accessState) {
      const project = projects.get(projectId);
      if (project !== undefined) {
        project.accessState = accessState;
      }
    },
    markPublished(projectId) {
      const project = projects.get(projectId);
      if (project !== undefined) {
        project.publishedFileState = 'published';
      }
    },
  };

  return { host, operator };
}
