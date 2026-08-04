/**
 * The semantic half of opening a native `.arq` project: turning the `model.json`
 * and `views.json` a file carries into the typed model the workspace renders.
 *
 * `@arq/project-format`'s `importArchive` already owns the archive half - path
 * safety, size and JSON-complexity limits, required-versus-optional entries, and
 * parsing each entry into `unknown`. It stops at `unknown` deliberately, and this
 * module is where that stops being good enough: a renderer cannot be handed
 * `unknown`, and casting it would mean a hostile or simply older file could put
 * `NaN` into a coordinate, a duplicate id into a selection set, or a reference to
 * a wall type that does not exist into the inspector.
 *
 * So every field is checked, and the shapes it produces are `@arq/bim-core`'s own
 * (`Wall`, `Level`, `WallType`, `Room`) rather than a second parallel model. This
 * is a reader, not a second semantic model: it adds validation and a statement of
 * what it did not consume, and nothing else.
 *
 * Two rules make the difference between a reader and a guesser:
 *
 * 1. An internally inconsistent project is refused, not partially shown. A wall
 *    pointing at a wall type the file does not define is a defect in the file or
 *    in whatever wrote it; drawing the other 78 walls and saying nothing would
 *    present an incomplete project as the project.
 * 2. Content this build does not display is reported, never dropped in silence.
 *    A project with 14 doors that renders no doors has to say so, or the user is
 *    entitled to believe their doors are gone.
 */
import { toMillimetres, type Length, type LengthUnit } from '@arq/bim-core';
import type {
  Level,
  Room,
  Wall,
  WallAlignment,
  WallType,
  ProjectUnitsPreference,
} from '@arq/bim-core';
import { worldPoint, type WorldPoint } from '@arq/geometry-2d';

/**
 * The model-schema tags this reader understands. A tag may carry a `+suffix`
 * annotation (the golden fixture marks itself `+fixture-v2`); the base before the
 * `+` is what decides whether the field meanings are known.
 *
 * An unknown base is refused rather than read hopefully, for the same reason
 * `arqfs-open.ts` refuses an unrecognised required feature flag: a reader that
 * proceeds anyway may silently misinterpret canonical semantics.
 */
const KNOWN_MODEL_SCHEMA_BASES: readonly string[] = ['arq-bim-core-reference-v0'];

export interface NativeProjectSummary {
  readonly projectId: string;
  readonly projectName: string;
  readonly units: ProjectUnitsPreference;
  readonly revision: number;
  readonly modelSchema: string;
  /** The repository revision recorded by whatever wrote the model, when it recorded one. */
  readonly sourceRepositoryRevision: string | null;
}

/** A view the file declares, and whether this build can present it. */
export interface NativeProjectView {
  readonly id: string;
  readonly name: string;
  readonly kind: string;
  readonly levelId: string | null;
  readonly scale: string | null;
  readonly supported: boolean;
  /** Why this build cannot present the view - null exactly when `supported`. */
  readonly unsupportedReason: string | null;
}

/**
 * Content the file contains and this build does not display. Counted from the
 * file, never estimated, so a surface can name the exact quantity.
 */
export interface NativeUnsupportedContent {
  readonly section: string;
  readonly count: number;
  readonly reason: string;
}

export interface NativeProjectModel {
  readonly summary: NativeProjectSummary;
  readonly levels: readonly Level[];
  readonly wallTypes: readonly WallType[];
  readonly walls: readonly Wall[];
  readonly rooms: readonly Room[];
  readonly views: readonly NativeProjectView[];
  readonly unsupported: readonly NativeUnsupportedContent[];
}

export type NativeProjectModelResult =
  | { readonly status: 'parsed'; readonly model: NativeProjectModel }
  | { readonly status: 'rejected'; readonly reason: string };

/** The view kinds this build has a surface for. Everything else is declared unsupported by name. */
const SUPPORTED_VIEW_KINDS: readonly string[] = ['plan', '3d'];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Rejects NaN and both infinities: a coordinate that is not a real number is not a coordinate. */
function finiteNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function nonEmptyString(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function optionalString(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

const LENGTH_UNITS: readonly string[] = ['mm', 'cm', 'm', 'in', 'ft'];

/** A `{ value, unit }` pair, converted to millimetres so callers never re-derive the unit maths. */
function lengthMillimetres(value: unknown): number | null {
  if (!isRecord(value)) {
    return null;
  }
  const magnitude = finiteNumber(value.value);
  const unit =
    typeof value.unit === 'string' && LENGTH_UNITS.includes(value.unit) ? value.unit : null;
  if (magnitude === null || unit === null) {
    return null;
  }
  const millimetres = toMillimetres({
    value: magnitude,
    unit: unit as LengthUnit,
  } satisfies Length);
  return Number.isFinite(millimetres) ? millimetres : null;
}

function point(value: unknown): WorldPoint | null {
  if (!isRecord(value)) {
    return null;
  }
  const x = finiteNumber(value.x);
  const y = finiteNumber(value.y);
  return x === null || y === null ? null : worldPoint(x, y);
}

function stringArray(value: unknown): readonly string[] | null {
  if (!Array.isArray(value)) {
    return null;
  }
  const result: string[] = [];
  for (const entry of value) {
    const id = nonEmptyString(entry);
    if (id === null) {
      return null;
    }
    result.push(id);
  }
  return result;
}

const WALL_ALIGNMENTS: readonly string[] = ['centre', 'interior', 'exterior'];
const WALL_JOIN_INTENTS: readonly string[] = ['auto', 'butt', 'mitre', 'disallow'];
const ROOM_STATUSES: readonly string[] = [
  'valid',
  'not-enclosed',
  'overlapping',
  'too-small',
  'invalid-polygon',
  'stale',
];

class RejectedModel extends Error {}

function reject(reason: string): never {
  throw new RejectedModel(reason);
}

function requireArray(container: Record<string, unknown>, key: string): readonly unknown[] {
  const value = container[key];
  if (!Array.isArray(value)) {
    reject(`model.json ${key} is missing or is not a list`);
  }
  return value;
}

/** Counts a section this build does not display, without parsing its contents. */
function countUnsupported(
  model: Record<string, unknown>,
  section: string,
  reason: string,
): NativeUnsupportedContent | null {
  const value = model[section];
  if (!Array.isArray(value) || value.length === 0) {
    return null;
  }
  return { section, count: value.length, reason };
}

function parseLevels(raw: readonly unknown[]): readonly Level[] {
  return raw.map((entry, index) => {
    if (!isRecord(entry)) {
      reject(`model.json levels[${index}] is not an object`);
    }
    const id = nonEmptyString(entry.id);
    const name = nonEmptyString(entry.name);
    const elevation = finiteNumber(entry.elevation);
    if (id === null || name === null || elevation === null) {
      reject(`model.json levels[${index}] is missing a usable id, name or elevation`);
    }
    const storeyHeight = finiteNumber(entry.storeyHeight);
    return {
      id: id as Level['id'],
      name,
      elevation,
      ...(storeyHeight === null ? {} : { storeyHeight }),
    };
  });
}

function parseWallTypes(raw: readonly unknown[]): readonly WallType[] {
  return raw.map((entry, index) => {
    if (!isRecord(entry)) {
      reject(`model.json wallTypes[${index}] is not an object`);
    }
    const id = nonEmptyString(entry.id);
    const name = nonEmptyString(entry.name);
    const thicknessMm = lengthMillimetres(entry.thickness);
    const defaultHeightMm = lengthMillimetres(entry.defaultHeight);
    if (id === null || name === null || thicknessMm === null || defaultHeightMm === null) {
      reject(`model.json wallTypes[${index}] is missing a usable id, name, thickness or height`);
    }
    if (thicknessMm <= 0 || defaultHeightMm <= 0) {
      // A zero or negative thickness would extrude to nothing in 3D and offset
      // to a degenerate outline in plan; refusing here keeps that out of both
      // renderers rather than letting each discover it.
      reject(`model.json wallTypes[${index}] has a thickness or height that is not positive`);
    }
    const wallFunction = entry.function;
    if (wallFunction !== 'exterior' && wallFunction !== 'interior') {
      reject(`model.json wallTypes[${index}] has an unrecognised function`);
    }
    return {
      id: id as WallType['id'],
      name,
      thickness: { value: thicknessMm, unit: 'mm' },
      defaultHeight: { value: defaultHeightMm, unit: 'mm' },
      function: wallFunction,
    };
  });
}

function parseWalls(raw: readonly unknown[]): readonly Wall[] {
  return raw.map((entry, index) => {
    if (!isRecord(entry)) {
      reject(`model.json walls[${index}] is not an object`);
    }
    const id = nonEmptyString(entry.id);
    const typeId = nonEmptyString(entry.typeId);
    const levelId = nonEmptyString(entry.levelId);
    const start = point(entry.start);
    const end = point(entry.end);
    if (id === null || typeId === null || levelId === null || start === null || end === null) {
      reject(`model.json walls[${index}] is missing a usable id, type, level or endpoint`);
    }
    if (start.x === end.x && start.y === end.y) {
      reject(`model.json walls[${index}] has zero length`);
    }
    const alignment = entry.alignment;
    if (typeof alignment !== 'string' || !WALL_ALIGNMENTS.includes(alignment)) {
      reject(`model.json walls[${index}] has an unrecognised alignment`);
    }
    for (const joinKey of ['joinStart', 'joinEnd'] as const) {
      const join = entry[joinKey];
      if (typeof join !== 'string' || !WALL_JOIN_INTENTS.includes(join)) {
        reject(`model.json walls[${index}] has an unrecognised ${joinKey}`);
      }
    }
    const hostedOpeningIds = stringArray(entry.hostedOpeningIds ?? []);
    if (hostedOpeningIds === null) {
      reject(`model.json walls[${index}] has a hostedOpeningIds entry that is not an id`);
    }
    const heightOverrideMm =
      entry.heightOverride === undefined ? null : lengthMillimetres(entry.heightOverride);
    if (entry.heightOverride !== undefined && heightOverrideMm === null) {
      reject(`model.json walls[${index}] has a height override that is not a length`);
    }
    return {
      id: id as Wall['id'],
      typeId: typeId as Wall['typeId'],
      levelId: levelId as Wall['levelId'],
      start,
      end,
      alignment: alignment as WallAlignment,
      joinStart: entry.joinStart as Wall['joinStart'],
      joinEnd: entry.joinEnd as Wall['joinEnd'],
      hostedOpeningIds: hostedOpeningIds as Wall['hostedOpeningIds'],
      ...(heightOverrideMm === null
        ? {}
        : { heightOverride: { value: heightOverrideMm, unit: 'mm' as const } }),
    };
  });
}

function parseRooms(raw: readonly unknown[]): readonly Room[] {
  return raw.map((entry, index) => {
    if (!isRecord(entry)) {
      reject(`model.json rooms[${index}] is not an object`);
    }
    const id = nonEmptyString(entry.id);
    const levelId = nonEmptyString(entry.levelId);
    const seedPoint = point(entry.seedPoint);
    if (id === null || levelId === null || seedPoint === null) {
      reject(`model.json rooms[${index}] is missing a usable id, level or seed point`);
    }
    const boundaryElementIds = stringArray(entry.boundaryElementIds ?? []);
    if (boundaryElementIds === null) {
      reject(`model.json rooms[${index}] has a boundary element that is not an id`);
    }
    const rawBoundary = entry.calculatedBoundary;
    if (!Array.isArray(rawBoundary)) {
      reject(`model.json rooms[${index}] has a calculatedBoundary that is not a list`);
    }
    // An empty list is allowed and meaningful: a room whose boundary could not be
    // computed is a real state the model carries (`status` says which). It is
    // `roomsOnLevel` that declines to draw one, not this parser that hides it.
    const calculatedBoundary = rawBoundary.map((vertex, vertexIndex) => {
      const value = point(vertex);
      if (value === null) {
        reject(`model.json rooms[${index}].calculatedBoundary[${vertexIndex}] is not a point`);
      }
      return value;
    });
    const status = entry.status;
    if (typeof status !== 'string' || !ROOM_STATUSES.includes(status)) {
      reject(`model.json rooms[${index}] has an unrecognised status`);
    }
    const name = nonEmptyString(entry.name);
    const calculatedArea = finiteNumber(entry.calculatedArea);
    if (name === null || calculatedArea === null) {
      reject(`model.json rooms[${index}] is missing a usable name or calculated area`);
    }
    const number = optionalString(entry.number);
    return {
      id: id as Room['id'],
      levelId: levelId as Room['levelId'],
      seedPoint,
      name,
      ...(number === null ? {} : { number }),
      boundaryElementIds: boundaryElementIds as Room['boundaryElementIds'],
      calculatedBoundary,
      calculatedArea,
      status: status as Room['status'],
    };
  });
}

/** Every id in a project must be unique across the sets a selection can address. */
function assertUniqueIds(model: {
  readonly levels: readonly Level[];
  readonly wallTypes: readonly WallType[];
  readonly walls: readonly Wall[];
  readonly rooms: readonly Room[];
}): void {
  const seen = new Set<string>();
  for (const [section, ids] of [
    ['levels', model.levels.map((level) => level.id as string)],
    ['wallTypes', model.wallTypes.map((type) => type.id as string)],
    ['walls', model.walls.map((wall) => wall.id as string)],
    ['rooms', model.rooms.map((room) => room.id as string)],
  ] as const) {
    for (const id of ids) {
      if (seen.has(id)) {
        // Two elements with one id means selection, the model tree and the
        // inspector would each pick a different winner.
        reject(`model.json contains a duplicate id in ${section}: ${id}`);
      }
      seen.add(id);
    }
  }
}

function assertReferencesResolve(model: {
  readonly levels: readonly Level[];
  readonly wallTypes: readonly WallType[];
  readonly walls: readonly Wall[];
  readonly rooms: readonly Room[];
}): void {
  const levelIds = new Set(model.levels.map((level) => level.id as string));
  const wallTypeIds = new Set(model.wallTypes.map((type) => type.id as string));
  for (const wall of model.walls) {
    if (!wallTypeIds.has(wall.typeId as string)) {
      reject(
        `model.json wall ${wall.id} references wall type ${wall.typeId}, which is not defined`,
      );
    }
    if (!levelIds.has(wall.levelId as string)) {
      reject(`model.json wall ${wall.id} references level ${wall.levelId}, which is not defined`);
    }
  }
  for (const room of model.rooms) {
    if (!levelIds.has(room.levelId as string)) {
      reject(`model.json room ${room.id} references level ${room.levelId}, which is not defined`);
    }
  }
}

/**
 * `views.json` is optional archive content, so a missing or unusable file is an
 * empty view list rather than a refusal: a project with unreadable view records
 * is still a project, and this build derives its own plan and 3D surfaces from
 * the levels regardless.
 */
export function parseNativeProjectViews(raw: unknown): readonly NativeProjectView[] {
  if (!isRecord(raw) || !Array.isArray(raw.views)) {
    return [];
  }
  const views: NativeProjectView[] = [];
  for (const entry of raw.views) {
    if (!isRecord(entry)) {
      continue;
    }
    const id = nonEmptyString(entry.id);
    const kind = nonEmptyString(entry.kind);
    if (id === null || kind === null) {
      continue;
    }
    const name = nonEmptyString(entry.name) ?? id;
    const declaredState = optionalString(entry.state);
    // Two different reasons a view cannot be presented, kept apart: a kind with
    // no surface in this build, and a view the file itself says was never
    // rendered. Collapsing them would tell a user their section view is
    // unsupported when the file says it was only ever proposed.
    const unsupportedReason =
      declaredState !== null && declaredState !== 'current'
        ? `The project records this view as "${declaredState}" rather than current.`
        : SUPPORTED_VIEW_KINDS.includes(kind)
          ? null
          : `This build has no ${kind} surface yet.`;
    views.push({
      id,
      name,
      kind,
      levelId: optionalString(entry.levelId),
      scale: optionalString(entry.scale),
      supported: unsupportedReason === null,
      unsupportedReason,
    });
  }
  return views;
}

/**
 * Parses `model.json`'s already-JSON-decoded value. Never throws: a file this
 * reader cannot trust comes back as `rejected` with the specific reason, which is
 * what a diagnostics surface shows and what a test can assert on.
 */
export function parseNativeProjectModel(
  raw: unknown,
  views: readonly NativeProjectView[] = [],
): NativeProjectModelResult {
  try {
    if (!isRecord(raw)) {
      reject('model.json is not an object');
    }
    const modelSchema = nonEmptyString(raw.modelSchema);
    if (modelSchema === null) {
      reject('model.json does not declare a modelSchema');
    }
    const schemaBase = modelSchema.split('+')[0]!;
    if (!KNOWN_MODEL_SCHEMA_BASES.includes(schemaBase)) {
      reject(
        `model.json declares model schema "${modelSchema}", which this build does not know how to read`,
      );
    }

    const project = raw.project;
    if (!isRecord(project)) {
      reject('model.json does not contain a project record');
    }
    const projectIdValue = nonEmptyString(project.id);
    const projectName = nonEmptyString(project.name);
    const revision = finiteNumber(project.revision);
    if (projectIdValue === null || projectName === null || revision === null) {
      reject('model.json project record is missing a usable id, name or revision');
    }
    if (!Number.isInteger(revision) || revision < 0) {
      reject('model.json project revision is not a whole number of revisions');
    }
    const units = project.units;
    if (units !== 'metric' && units !== 'imperial') {
      reject('model.json project record does not declare metric or imperial units');
    }

    const levels = parseLevels(requireArray(raw, 'levels'));
    const wallTypes = parseWallTypes(requireArray(raw, 'wallTypes'));
    const walls = parseWalls(requireArray(raw, 'walls'));
    // Rooms are optional: a project may legitimately have none.
    const rooms = Array.isArray(raw.rooms) ? parseRooms(raw.rooms) : [];
    if (levels.length === 0) {
      reject('model.json declares no levels, so there is nothing to place geometry on');
    }
    const parts = { levels, wallTypes, walls, rooms };
    assertUniqueIds(parts);
    assertReferencesResolve(parts);

    const unsupported = [
      countUnsupported(raw, 'openings', 'Openings are recorded but not drawn in plan or 3D yet.'),
      countUnsupported(raw, 'doors', 'Doors are recorded but not drawn in plan or 3D yet.'),
      countUnsupported(raw, 'windows', 'Windows are recorded but not drawn in plan or 3D yet.'),
      countUnsupported(
        raw,
        'linearDimensions',
        'Dimensions are recorded but not drawn in plan yet.',
      ),
    ].filter((entry): entry is NativeUnsupportedContent => entry !== null);

    return {
      status: 'parsed',
      model: {
        summary: {
          projectId: projectIdValue,
          projectName,
          units: units satisfies ProjectUnitsPreference,
          revision,
          modelSchema,
          sourceRepositoryRevision: optionalString(raw.sourceRepositoryRevision),
        },
        levels,
        wallTypes,
        walls,
        rooms,
        views,
        unsupported,
      },
    };
  } catch (error) {
    if (error instanceof RejectedModel) {
      return { status: 'rejected', reason: error.message };
    }
    throw error;
  }
}

/** The walls placed on one level, in file order so two runs agree. */
export function wallsOnLevel(model: NativeProjectModel, levelId: string): readonly Wall[] {
  return model.walls.filter((wall) => (wall.levelId as string) === levelId);
}

/**
 * The rooms placed on one level that have a boundary this build can draw. A
 * polygon needs three vertices; two would render as a line carrying an area
 * label, which is worse than not drawing it - the room is still listed in the
 * model tree either way.
 */
export function roomsOnLevel(model: NativeProjectModel, levelId: string): readonly Room[] {
  return model.rooms.filter(
    (room) => (room.levelId as string) === levelId && room.calculatedBoundary.length >= 3,
  );
}

/** The wall type a wall reads its thickness and height through; never null after a successful parse. */
export function wallTypeFor(model: NativeProjectModel, wall: Wall): WallType | null {
  return model.wallTypes.find((type) => type.id === wall.typeId) ?? null;
}
