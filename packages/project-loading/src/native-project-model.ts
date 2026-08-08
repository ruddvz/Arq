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
  Door,
  DoorHand,
  DoorSide,
  Level,
  Opening,
  OpeningKind,
  Room,
  Wall,
  WallAlignment,
  WallType,
  Window,
  WindowSide,
  ProjectUnitsPreference,
} from '@arq/bim-core';
import { worldPoint, type WorldPoint } from '@arq/geometry-2d';
import {
  parsePlacedContent,
  type NativeFurnishing,
  type NativeSlab,
  type NativeStair,
  type NativeServicePoint,
  type NativePathway,
  type PlacedContent,
} from './placed-content';

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
  /**
   * Which way is north, as a bearing in degrees clockwise from the model's +Y
   * axis, or null when the file does not say.
   *
   * Null and zero are different answers and both are real. Zero is "north is up
   * the page", which most projects are and which a file can state. Null is "this
   * file does not say", and a drawing that assumes zero for it has invented an
   * orientation - so a surface can draw the arrow for one and omit it for the
   * other, which is the difference between a plan that is oriented and a plan
   * that merely looks oriented.
   */
  readonly northBearingDegrees: number | null;
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
  /**
   * Hosted openings, and the doors and windows that occupy them. Three lists
   * rather than one because that is the canonical shape: an Opening is the void
   * in the wall and carries the geometry, while a Door or Window is the thing
   * placed in it and carries only what the void does not - side, hand, swing.
   */
  readonly openings: readonly Opening[];
  readonly doors: readonly Door[];
  readonly windows: readonly Window[];
  readonly rooms: readonly Room[];
  /**
   * What stands on the levels besides walls: furniture and fixed equipment, the
   * floor and roof plates, and the stairs between them. Optional in the file and
   * empty for a project this build wrote; see `placed-content.ts` for why these
   * are footprints rather than semantic Furniture/Slab/Stair records.
   */
  readonly furnishings: readonly NativeFurnishing[];
  readonly slabs: readonly NativeSlab[];
  readonly stairs: readonly NativeStair[];
  /**
   * Building services - luminaires, outlets, sanitary fittings and plant - and
   * the walkable routes between them. Both carry real coordinates in the file
   * and were being counted as unread content until they were drawn.
   */
  readonly servicePoints: readonly NativeServicePoint[];
  readonly pathways: readonly NativePathway[];
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

/**
 * Unsupported content the model declares about itself.
 *
 * Malformed entries are skipped rather than rejected. This list is a courtesy -
 * it says what a build cannot show - and refusing to open a project because its
 * apology is badly formed would turn a warning into an outage.
 */
function parseDeclaredUnsupported(value: unknown): readonly NativeUnsupportedContent[] {
  if (!Array.isArray(value)) {
    return [];
  }
  const entries: NativeUnsupportedContent[] = [];
  for (const entry of value) {
    if (!isRecord(entry)) continue;
    const section = nonEmptyString(entry.section);
    const reason = nonEmptyString(entry.reason);
    const count = finiteNumber(entry.count);
    if (section === null || reason === null || count === null || count <= 0) continue;
    entries.push({ section, count: Math.floor(count), reason });
  }
  return entries;
}

/**
 * The project's north, as a bearing clockwise from +Y.
 *
 * The file states it as an axis name - `"+Y"`, `"-X"` - rather than as an
 * angle, which is how a generator that only ever produces axis-aligned north
 * would write it. Both spellings are read, and a numeric bearing wins where a
 * file gives one, so a project surveyed at 23 degrees is not rounded to the
 * nearest axis.
 *
 * Anything else is null rather than a guess. A wrongly oriented plan is worse
 * than an unoriented one: a reader trusts an arrow.
 */
const NORTH_AXIS_BEARINGS: Readonly<Record<string, number>> = {
  '+y': 0,
  '+x': 90,
  '-y': 180,
  '-x': 270,
};

function parseNorthBearing(value: unknown): number | null {
  if (!isRecord(value)) return null;
  const numeric = finiteNumber(value.northBearingDegrees ?? value.northDegrees);
  if (numeric !== null) {
    // Normalised into [0, 360) so a surface never has to. A file may state -90.
    return ((numeric % 360) + 360) % 360;
  }
  const axis = nonEmptyString(value.north);
  if (axis === null) return null;
  return NORTH_AXIS_BEARINGS[axis.toLowerCase().replace(/\s+/g, '')] ?? null;
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

/**
 * How far past its host wall's end an opening may reach before the model is
 * refused. Not zero: offsets and wall endpoints are authored independently and
 * both round, so an opening that ends exactly at the wall face can miss by a
 * fraction of a millimetre. A tenth of a millimetre is below anything drawable
 * and far below anything buildable.
 */
const OPENING_FIT_TOLERANCE_MM = 0.1;

const OPENING_KINDS: readonly string[] = ['door', 'window', 'void'];
const SIDES: readonly string[] = ['left', 'right'];

/**
 * Hosted openings.
 *
 * Until this existed the reader counted `openings` as unsupported content and
 * told the user "Openings are recorded but not drawn in plan or 3D yet" - which
 * was true, and was the honest thing to say while it was true. Parsing them is
 * what makes it stop being true.
 *
 * Geometry is validated here rather than at the renderer because an opening
 * wider than its host wall, or one hanging off the end of it, is not a drawing
 * problem: it is a model that does not describe a building. Both renderers would
 * otherwise have to guess, and would guess differently.
 */
function parseOpenings(raw: readonly unknown[]): readonly Opening[] {
  return raw.map((entry, index) => {
    if (!isRecord(entry)) {
      reject(`model.json openings[${index}] is not an object`);
    }
    const id = nonEmptyString(entry.id);
    const hostWallId = nonEmptyString(entry.hostWallId);
    const kind =
      typeof entry.kind === 'string' && OPENING_KINDS.includes(entry.kind) ? entry.kind : null;
    const offsetMm = lengthMillimetres(entry.offsetFromWallStart);
    const widthMm = lengthMillimetres(entry.width);
    const sillMm = lengthMillimetres(entry.sillHeight);
    const heightMm = lengthMillimetres(entry.height);
    if (
      id === null ||
      hostWallId === null ||
      kind === null ||
      offsetMm === null ||
      widthMm === null ||
      sillMm === null ||
      heightMm === null
    ) {
      reject(
        `model.json openings[${index}] is missing a usable id, host wall, kind, offset, width, sill or height`,
      );
    }
    if (widthMm <= 0 || heightMm <= 0) {
      // A zero-width opening cuts nothing and draws nothing, and a negative one
      // would invert the panel decomposition in geometry-3d.
      reject(`model.json openings[${index}] has a width or height that is not positive`);
    }
    if (offsetMm < 0 || sillMm < 0) {
      reject(`model.json openings[${index}] has a negative offset or sill height`);
    }
    return {
      id: id as Opening['id'],
      hostWallId: hostWallId as Opening['hostWallId'],
      kind: kind as OpeningKind,
      offsetFromWallStart: { value: offsetMm, unit: 'mm' },
      width: { value: widthMm, unit: 'mm' },
      sillHeight: { value: sillMm, unit: 'mm' },
      height: { value: heightMm, unit: 'mm' },
    };
  });
}

function parseDoors(raw: readonly unknown[]): readonly Door[] {
  return raw.map((entry, index) => {
    if (!isRecord(entry)) {
      reject(`model.json doors[${index}] is not an object`);
    }
    const id = nonEmptyString(entry.id);
    const typeId = nonEmptyString(entry.typeId);
    const openingId = nonEmptyString(entry.openingId);
    const levelId = nonEmptyString(entry.levelId);
    if (id === null || typeId === null || openingId === null || levelId === null) {
      reject(`model.json doors[${index}] is missing a usable id, type, opening or level`);
    }
    const side = typeof entry.side === 'string' && SIDES.includes(entry.side) ? entry.side : null;
    const hand = typeof entry.hand === 'string' && SIDES.includes(entry.hand) ? entry.hand : null;
    if (side === null || hand === null) {
      reject(`model.json doors[${index}] has an unrecognised side or hand`);
    }
    const swingAngle = finiteNumber(entry.swingAngle);
    // A swing is drawn as an arc from the leaf's closed position. Outside
    // 0..180 the arc would sweep back through the wall it is hosted in.
    if (swingAngle === null || swingAngle < 0 || swingAngle > 180) {
      reject(`model.json doors[${index}] has a swing angle outside 0 to 180 degrees`);
    }
    return {
      id: id as Door['id'],
      typeId: typeId as Door['typeId'],
      openingId: openingId as Door['openingId'],
      levelId: levelId as Door['levelId'],
      side: side as DoorSide,
      hand: hand as DoorHand,
      swingAngle,
    };
  });
}

function parseWindows(raw: readonly unknown[]): readonly Window[] {
  return raw.map((entry, index) => {
    if (!isRecord(entry)) {
      reject(`model.json windows[${index}] is not an object`);
    }
    const id = nonEmptyString(entry.id);
    const typeId = nonEmptyString(entry.typeId);
    const openingId = nonEmptyString(entry.openingId);
    const levelId = nonEmptyString(entry.levelId);
    if (id === null || typeId === null || openingId === null || levelId === null) {
      reject(`model.json windows[${index}] is missing a usable id, type, opening or level`);
    }
    const side = typeof entry.side === 'string' && SIDES.includes(entry.side) ? entry.side : null;
    if (side === null) {
      reject(`model.json windows[${index}] has an unrecognised side`);
    }
    return {
      id: id as Window['id'],
      typeId: typeId as Window['typeId'],
      openingId: openingId as Window['openingId'],
      levelId: levelId as Window['levelId'],
      side: side as WindowSide,
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
interface ModelParts {
  readonly levels: readonly Level[];
  readonly wallTypes: readonly WallType[];
  readonly walls: readonly Wall[];
  readonly openings: readonly Opening[];
  readonly doors: readonly Door[];
  readonly windows: readonly Window[];
  readonly rooms: readonly Room[];
}

function assertUniqueIds(model: ModelParts): void {
  const seen = new Set<string>();
  for (const [section, ids] of [
    ['levels', model.levels.map((level) => level.id as string)],
    ['wallTypes', model.wallTypes.map((type) => type.id as string)],
    ['walls', model.walls.map((wall) => wall.id as string)],
    ['openings', model.openings.map((opening) => opening.id as string)],
    ['doors', model.doors.map((door) => door.id as string)],
    ['windows', model.windows.map((window) => window.id as string)],
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

/**
 * Placed content points at the same levels and rooms everything else does.
 *
 * Separate from `assertReferencesResolve` because it runs on a separate parse:
 * these three sections are optional and a project this build wrote has none of
 * them, so folding them into `ModelParts` would make every existing caller
 * carry three empty lists to say nothing.
 *
 * An unresolved `roomId` is rejected rather than nulled. The file is asserting
 * that this desk is in the study; if the study is not there, the assertion is
 * about a different model than the one being opened, and quietly dropping the
 * link would leave a desk in no room with nothing to say it ever claimed one.
 */
function assertPlacedContentResolves(content: PlacedContent, model: ModelParts): void {
  const levelIds = new Set(model.levels.map((level) => level.id as string));
  const roomIds = new Set(model.rooms.map((room) => room.id as string));
  const seen = new Set<string>();
  const claim = (section: string, id: string): void => {
    if (seen.has(id)) {
      reject(`model.json contains a duplicate id in ${section}: ${id}`);
    }
    seen.add(id);
  };

  for (const furnishing of content.furnishings) {
    claim('furnishings', furnishing.id);
    if (!levelIds.has(furnishing.levelId)) {
      reject(
        `model.json furnishing ${furnishing.id} references level ${furnishing.levelId}, which is not defined`,
      );
    }
    if (furnishing.roomId !== null && !roomIds.has(furnishing.roomId)) {
      reject(
        `model.json furnishing ${furnishing.id} references room ${furnishing.roomId}, which is not defined`,
      );
    }
  }
  for (const slab of content.slabs) {
    claim('slabs', slab.id);
    if (!levelIds.has(slab.levelId)) {
      reject(`model.json slab ${slab.id} references level ${slab.levelId}, which is not defined`);
    }
  }
  for (const stair of content.stairs) {
    claim('stairs', stair.id);
    for (const flight of stair.flights) claim('stairs', flight.id);
    for (const landing of stair.landings) claim('stairs', landing.id);
  }
  for (const point of content.servicePoints) {
    claim('servicePoints', point.id);
    if (!levelIds.has(point.levelId)) {
      reject(
        `model.json service point ${point.id} references level ${point.levelId}, which is not defined`,
      );
    }
    /*
     * An unresolved `roomId` is rejected on a furnishing and tolerated here.
     *
     * The difference is what the field is doing. A desk claims to be in the
     * study, and a study that is not there means the claim is about a different
     * model. A services point's room is a schedule grouping - which room's
     * lighting circuit this belongs to - and the point still has a position,
     * still draws in the right place, and is still the fitting the file says it
     * is. Refusing to open a house because one roof drain is filed under the
     * wrong roof room would be a validator with no sense of proportion.
     *
     * This fixture has four such points, and they are recorded in
     * `validation/arq-house-17/FIXTURE_DEFECTS_17_0.md` rather than silently
     * accepted: three roof drains at the roof corners filed under whichever
     * room was nearest to hand, one of them 11.4 metres from it.
     */
  }
  for (const pathway of content.pathways) {
    claim('pathways', pathway.id);
    if (!levelIds.has(pathway.levelId)) {
      reject(
        `model.json pathway ${pathway.id} references level ${pathway.levelId}, which is not defined`,
      );
    }
  }
}

function assertReferencesResolve(model: ModelParts): void {
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

  /*
   * An opening's host wall decides everything about where it is drawn: the
   * offset is measured along that wall's centreline and the void is cut through
   * that wall's thickness. An unresolved host is not a missing label, it is an
   * opening with no position at all.
   */
  const wallsById = new Map(model.walls.map((wall) => [wall.id as string, wall]));
  const wallLengths = new Map<string, number>();
  for (const opening of model.openings) {
    const host = wallsById.get(opening.hostWallId as string);
    if (host === undefined) {
      reject(
        `model.json opening ${opening.id} references wall ${opening.hostWallId}, which is not defined`,
      );
    }
    let hostLength = wallLengths.get(host.id as string);
    if (hostLength === undefined) {
      hostLength = Math.hypot(host.end.x - host.start.x, host.end.y - host.start.y);
      wallLengths.set(host.id as string, hostLength);
    }
    // Checked against the host rather than in `parseOpenings`, because "too
    // wide" is only meaningful once the wall it sits in is known. An opening
    // running past the end of its wall would decompose into a negative-width
    // pier in geometry-3d and a reversed gap in plan.
    const end = opening.offsetFromWallStart.value + opening.width.value;
    if (end > hostLength + OPENING_FIT_TOLERANCE_MM) {
      reject(
        `model.json opening ${opening.id} ends ${(end - hostLength).toFixed(1)} mm past the end of wall ${host.id}`,
      );
    }
  }

  const openingsById = new Map(model.openings.map((opening) => [opening.id as string, opening]));
  const occupied = new Map<string, string>();
  for (const [section, placed] of [
    ['door', model.doors],
    ['window', model.windows],
  ] as const) {
    for (const instance of placed) {
      const openingId = instance.openingId as string;
      const opening = openingsById.get(openingId);
      if (opening === undefined) {
        reject(
          `model.json ${section} ${instance.id} references opening ${openingId}, which is not defined`,
        );
      }
      if (!levelIds.has(instance.levelId as string)) {
        reject(
          `model.json ${section} ${instance.id} references level ${instance.levelId}, which is not defined`,
        );
      }
      // One void holds one thing. Two instances in one opening would draw a
      // door and a window in the same hole, and neither renderer has a rule for
      // which wins.
      const existing = occupied.get(openingId);
      if (existing !== undefined) {
        reject(
          `model.json opening ${openingId} is occupied by both ${existing} and ${instance.id}`,
        );
      }
      occupied.set(openingId, instance.id as string);
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
    /*
     * Openings and their occupants are optional in the same way, and for a
     * stronger reason: a project written by this build has none, so requiring
     * them would refuse files this build itself produced.
     */
    const openings = Array.isArray(raw.openings) ? parseOpenings(raw.openings) : [];
    const doors = Array.isArray(raw.doors) ? parseDoors(raw.doors) : [];
    const windows = Array.isArray(raw.windows) ? parseWindows(raw.windows) : [];
    if (levels.length === 0) {
      reject('model.json declares no levels, so there is nothing to place geometry on');
    }
    const parts = { levels, wallTypes, walls, openings, doors, windows, rooms };
    assertUniqueIds(parts);
    assertReferencesResolve(parts);

    /*
     * Furnishings, slabs and stairs. Parsed after the walls and rooms so their
     * level and room references can be checked against real levels and rooms:
     * a wardrobe on a level that does not exist would draw on whichever storey
     * happened to be on show, which is worse than not drawing it.
     */
    const placed = parsePlacedContent(raw);
    if (placed.status === 'rejected') {
      reject(placed.reason);
    }
    assertPlacedContentResolves(placed.content, parts);

    /*
     * What is left unsupported, and nothing more.
     *
     * Openings, doors and windows used to be counted here with the message
     * "recorded but not drawn in plan or 3D yet". They are parsed now, so that
     * message would be untrue in the other direction - and an unsupported-content
     * warning a user cannot act on, about content that is in fact drawn, is
     * worse than none: it teaches them to ignore the warnings that are real.
     *
     * A `void` opening is the exception that stays. It is a hole with nothing
     * placed in it, and this build draws the void but has no elevation surface
     * on which its sill and head heights mean anything, so it is reported rather
     * than silently flattened.
     */
    const unsupported = [
      countUnsupported(
        raw,
        'linearDimensions',
        'Dimensions are recorded but not drawn in plan yet.',
      ),
      /*
       * Content the file declares that this reader has no field for at all.
       *
       * Counted here from `unsupportedContent` rather than discovered, because
       * discovery would mean this module knowing every vocabulary any file might
       * use. Whatever adapts a foreign model knows what it left behind and is the
       * only thing that can say so honestly; this carries the declaration through
       * to a surface that can show it.
       */
      ...parseDeclaredUnsupported(raw.unsupportedContent),
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
          northBearingDegrees: parseNorthBearing(raw.coordinateSystem),
        },
        levels,
        wallTypes,
        walls,
        openings,
        doors,
        windows,
        rooms,
        furnishings: placed.content.furnishings,
        slabs: placed.content.slabs,
        stairs: placed.content.stairs,
        servicePoints: placed.content.servicePoints,
        pathways: placed.content.pathways,
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
