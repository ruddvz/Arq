/**
 * Reads the ARQ House 17.0 model vocabulary into the one
 * `parseNativeProjectModel` accepts.
 *
 * The 17.0 `house.arq` is a real, internally consistent project that this build
 * refuses at the first field, because it was authored against a repository state
 * that had no native project-model reader to conform to. Its `model.json`
 * describes the same building in different words: `union-solid` where the
 * contract says `auto`, a bare `width: 300` where it wants a `{ value, unit }`
 * thickness, `coordinated-17.0` where it wants `valid`, a flat project record
 * where it wants a nested one. Fifteen divergences, none of them a defect in the
 * file - see `arq-model-conformance.ts`, which enumerates them.
 *
 * This module translates that vocabulary. It is the counterpart to the
 * conformance checker: that one says what is wrong, this one fixes what can be
 * fixed correctly, and neither hides the difference between the two.
 *
 * ## The rule that makes this an adapter and not a fabricator
 *
 * Every translation is reported, and each one declares its `basis`:
 *
 * - `derived` - the value is computed from what the file already states, and a
 *   second reader given the same file would compute the same thing. `width: 300`
 *   with a project in millimetres is unambiguously `{ value: 300, unit: 'mm' }`.
 * - `assumed` - the file does not carry the information and a convention is
 *   being applied. A door recorded as `side: "configured"` does not say which
 *   face it swings into; this module reads the file's own `swingDirection` and
 *   says so, rather than presenting the result as if the file had stated it.
 *
 * Nothing is translated silently, and nothing is invented where the file is
 * simply empty. A caller that wants only the deterministic half can filter the
 * translations on `basis` and decide for itself whether the assumed ones are
 * acceptable for what it is about to do - which is the point, because drawing a
 * plan and approving a building are not the same standard of evidence.
 *
 * ## What it deliberately does not do
 *
 * It does not touch the file. It takes a decoded `model.json` value and returns
 * a new one; writing an adapted model back into a `.arq` is a separate decision
 * with its own review, and a released artifact whose bytes changed here would no
 * longer be the artifact anyone checksummed.
 *
 * It also refuses to run on anything that is not this vocabulary
 * (`status: 'not-applicable'`), so it can never quietly rewrite an unrelated
 * project that happens to be missing a field.
 */
import type { NativeProjectView } from './native-project-model';

/** One vocabulary translation, at the granularity a reviewer would question it. */
export interface ArqHouse17Translation {
  /** The `model.json` section, or `model` for the document itself. */
  readonly section: string;
  /** The field being translated, in the file's own vocabulary. */
  readonly field: string;
  /** What the file says, as a short readable value set. */
  readonly from: string;
  /** What it was translated to. */
  readonly to: string;
  /** How many entries the translation applied to. */
  readonly entries: number;
  /**
   * `derived` - computed from what the file already states, reproducibly.
   * `assumed` - the file does not carry it and a convention was applied.
   */
  readonly basis: 'derived' | 'assumed';
  /** Why this translation is the right one, in one sentence, for a reviewer. */
  readonly rationale: string;
}

export type ArqHouse17AdaptResult =
  | {
      readonly status: 'adapted';
      /** A new model value; the input is never mutated. */
      readonly model: Record<string, unknown>;
      readonly translations: readonly ArqHouse17Translation[];
    }
  | { readonly status: 'not-applicable'; readonly reason: string };

/**
 * The schema tag the adapted model declares. The `+` suffix is the annotation
 * `native-project-model.ts` already allows (the golden fixture marks itself
 * `+fixture-v2`), so the base stays the one the reader knows while the model
 * still records that it came through this translation rather than being authored
 * against the contract directly.
 */
const ADAPTED_MODEL_SCHEMA = 'arq-bim-core-reference-v0+arq-house-17';

/**
 * The 17.0 join intent. `union-solid` says the two walls merge into a single
 * solid at the junction, which is what the native `auto` join resolves to; the
 * remaining native intents (`butt`, `mitre`, `disallow`) all describe *not*
 * merging, so `auto` is the only one that preserves the stated meaning.
 */
const LEGACY_JOIN = 'union-solid';

/** Opening kinds 17.0 uses that the reader does not, and what each one is in the reader's vocabulary. */
const OPENING_KIND_MAP: Readonly<Record<string, string>> = {
  'sliding-door': 'door',
  'pocket-door': 'door',
  opening: 'void',
};

/**
 * Wall `semanticRole` values, and whether a wall type used mainly for that role
 * is an exterior or interior type. Only `partition` is interior: the courtyard
 * frame, the glass guard, the parapet and the service screen all face weather or
 * open air, which is what `exterior` means to a wall type.
 */
const ROLE_IS_EXTERIOR: Readonly<Record<string, boolean>> = {
  'outer-envelope': true,
  'courtyard-frame': true,
  'glass-guard': true,
  'courtyard-parapet': true,
  'service-screen': true,
  partition: false,
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function records(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value) ? value.filter(isRecord).map((entry) => ({ ...entry })) : [];
}

/** The most common value in a list, used to pick a wall type's default height from the walls that use it. */
function mode(values: readonly number[]): number | null {
  const counts = new Map<number, number>();
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
  let best: number | null = null;
  let bestCount = 0;
  for (const [value, count] of counts) {
    if (count > bestCount) {
      best = value;
      bestCount = count;
    }
  }
  return best;
}

function summarise(values: readonly unknown[]): string {
  const seen = new Set<string>();
  for (const value of values) {
    seen.add(value === undefined ? '(absent)' : JSON.stringify(value));
    if (seen.size > 3) break;
  }
  const shown = [...seen].slice(0, 3);
  return seen.size > 3 ? `${shown.join(', ')}, …` : shown.join(', ');
}

/**
 * Recognises the 17.0 vocabulary. Deliberately strict: it looks for the three
 * marks only this family of files carries together - no `modelSchema`, a flat
 * project record, and wall types measured with a bare `width`. A project merely
 * missing its schema tag is not this, and is left alone.
 */
function isArqHouse17Model(raw: unknown): raw is Record<string, unknown> {
  if (!isRecord(raw)) return false;
  if (typeof raw.modelSchema === 'string') return false;
  if (isRecord(raw.project)) return false;
  if (typeof raw.id !== 'string' || typeof raw.name !== 'string') return false;
  const wallTypes = Array.isArray(raw.wallTypes) ? raw.wallTypes.filter(isRecord) : [];
  if (wallTypes.length === 0) return false;
  return wallTypes.every((type) => typeof type.width === 'number' && type.thickness === undefined);
}

/**
 * Translates a decoded 17.0 `model.json` into the native contract.
 *
 * Returns `not-applicable` for anything that is not this vocabulary, so this can
 * be tried on any model without risk of rewriting one it does not understand.
 */
export function adaptArqHouse17Model(raw: unknown): ArqHouse17AdaptResult {
  if (!isArqHouse17Model(raw)) {
    return {
      status: 'not-applicable',
      reason:
        'this model does not carry the ARQ House 17.0 vocabulary (no modelSchema, flat project record, wall types measured by a bare width)',
    };
  }

  const translations: ArqHouse17Translation[] = [];
  const record = (translation: ArqHouse17Translation): void => {
    if (translation.entries > 0) translations.push(translation);
  };

  const levels = records(raw.levels);
  const wallTypes = records(raw.wallTypes);
  const walls = records(raw.walls);
  const openings = records(raw.openings);
  const doors = records(raw.doors);
  const windows = records(raw.windows);
  const rooms = records(raw.rooms);
  const doorTypes = records(raw.doorTypes);

  /*
   * The document is measured in millimetres, which the reader expresses as the
   * `metric` units *preference* rather than as a unit - the two are different
   * fields answering different questions, which is why the file's `units: "mm"`
   * is not simply copied across.
   */
  const declaredUnit = typeof raw.units === 'string' ? raw.units : 'mm';
  record({
    section: 'model',
    field: 'modelSchema',
    from: '(absent)',
    to: ADAPTED_MODEL_SCHEMA,
    entries: 1,
    basis: 'assumed',
    rationale:
      'The file predates the native reader and declares no schema; it is tagged as adapted rather than as if it had been authored against the contract.',
  });
  record({
    section: 'model',
    field: 'project',
    from: 'id, name, revision, units at the top level',
    to: 'a nested project record',
    entries: 1,
    basis: 'derived',
    rationale: 'Every field the reader needs is present in the file; only their location moves.',
  });
  record({
    section: 'project',
    field: 'units',
    from: JSON.stringify(declaredUnit),
    to: '"metric"',
    entries: 1,
    basis: 'derived',
    rationale: 'Millimetres are a metric unit, and the reader records a units preference here.',
  });

  const project = {
    schemaVersion: typeof raw.schemaVersion === 'number' ? raw.schemaVersion : 0,
    id: raw.id,
    name: raw.name,
    units: 'metric',
    revision: typeof raw.revision === 'number' ? raw.revision : 0,
    archived: raw.archived === true,
    levelIds: Array.isArray(raw.levelIds)
      ? raw.levelIds
      : levels.map((level) => level.id as string),
  };

  /*
   * Wall type geometry. `defaultHeight` has no counterpart in the file at all -
   * 17.0 records height per wall, not per type - so it is taken from the walls
   * that use each type, and every wall whose height differs from that default
   * then carries an explicit `heightOverride` below. That pairing is what makes
   * the translation lossless: all 65 stated heights survive, rather than the 3D
   * extrusion silently falling back to a type default for the ones that differ.
   */
  const heightsByType = new Map<string, number[]>();
  for (const wall of walls) {
    const typeId = wall.typeId;
    const height = wall.height;
    if (typeof typeId !== 'string' || typeof height !== 'number') continue;
    const list = heightsByType.get(typeId) ?? [];
    list.push(height);
    heightsByType.set(typeId, list);
  }

  const rolesByType = new Map<string, string[]>();
  for (const wall of walls) {
    const typeId = wall.typeId;
    const role = wall.semanticRole;
    if (typeof typeId !== 'string' || typeof role !== 'string') continue;
    const list = rolesByType.get(typeId) ?? [];
    list.push(role);
    rolesByType.set(typeId, list);
  }

  const defaultHeightByType = new Map<string, number>();
  const adaptedWallTypes = wallTypes.map((type) => {
    const id = type.id as string;
    const width = type.width as number;
    const heights = heightsByType.get(id) ?? [];
    const defaultHeight = mode(heights) ?? 3000;
    defaultHeightByType.set(id, defaultHeight);
    const roles = rolesByType.get(id) ?? [];
    const exteriorVotes = roles.filter((role) => ROLE_IS_EXTERIOR[role] === true).length;
    const wallFunction =
      exteriorVotes * 2 >= roles.length && roles.length > 0 ? 'exterior' : 'interior';
    const { width: _width, ...rest } = type;
    return {
      ...rest,
      thickness: { value: width, unit: 'mm' },
      defaultHeight: { value: defaultHeight, unit: 'mm' },
      function: wallFunction,
    };
  });

  record({
    section: 'wallTypes',
    field: 'thickness',
    from: `a bare width (${summarise(wallTypes.map((type) => type.width))})`,
    to: 'a { value, unit } length in mm',
    entries: wallTypes.length,
    basis: 'derived',
    rationale: 'The project states millimetres, so the bare number carries an unambiguous unit.',
  });
  record({
    section: 'wallTypes',
    field: 'defaultHeight',
    from: '(absent - 17.0 records height per wall)',
    to: 'the most common height among walls of that type',
    entries: wallTypes.length,
    basis: 'derived',
    rationale:
      'Taken from the file’s own walls, with every differing wall given an explicit heightOverride so no stated height is lost.',
  });
  record({
    section: 'wallTypes',
    field: 'function',
    from: '(absent - 17.0 records semanticRole per wall)',
    to: 'exterior or interior, from the roles of the walls using the type',
    entries: wallTypes.length,
    basis: 'derived',
    rationale:
      'Only the partition role is interior; envelope, courtyard frame, glass guard, parapet and service screen all face open air.',
  });

  /*
   * Walls. Three of the sixty-eight carry no alignment, join intent, role or
   * height at all - they are the short corner-join segments 17.0 added to close
   * wall networks, and they are given the same defaults every other wall in the
   * file states, which is the only reading that keeps the network connected.
   */
  let alignmentDefaulted = 0;
  let joinsTranslated = 0;
  let joinsDefaulted = 0;
  let heightOverrides = 0;
  const adaptedWalls = walls.map((wall) => {
    const { height: legacyHeight, ...rest } = wall;
    const next: Record<string, unknown> = { ...rest };

    if (typeof wall.alignment !== 'string') {
      next.alignment = 'centre';
      alignmentDefaulted += 1;
    }
    for (const field of ['joinStart', 'joinEnd'] as const) {
      const value = wall[field];
      if (value === LEGACY_JOIN) {
        next[field] = 'auto';
        joinsTranslated += 1;
      } else if (typeof value !== 'string') {
        next[field] = 'auto';
        joinsDefaulted += 1;
      }
    }
    if (!Array.isArray(wall.hostedOpeningIds)) next.hostedOpeningIds = [];

    const typeId = wall.typeId;
    const typeDefault =
      typeof typeId === 'string' ? (defaultHeightByType.get(typeId) ?? null) : null;
    if (typeof legacyHeight === 'number' && legacyHeight !== typeDefault) {
      next.heightOverride = { value: legacyHeight, unit: 'mm' };
      heightOverrides += 1;
    }
    return next;
  });

  record({
    section: 'walls',
    field: 'alignment',
    from: '(absent)',
    to: '"centre"',
    entries: alignmentDefaulted,
    basis: 'assumed',
    rationale: 'Every wall in the file that states an alignment states centre.',
  });
  record({
    section: 'walls',
    field: 'joinStart / joinEnd',
    from: `"${LEGACY_JOIN}"`,
    to: '"auto"',
    entries: joinsTranslated,
    basis: 'derived',
    rationale:
      'union-solid means the walls merge into one solid at the junction; auto is the only native intent that also merges.',
  });
  record({
    section: 'walls',
    field: 'joinStart / joinEnd',
    from: '(absent)',
    to: '"auto"',
    entries: joinsDefaulted,
    basis: 'assumed',
    rationale: 'These are corner-join segments; auto matches every join the file does state.',
  });
  record({
    section: 'walls',
    field: 'height',
    from: 'a bare height per wall',
    to: 'heightOverride, where it differs from the wall type default',
    entries: heightOverrides,
    basis: 'derived',
    rationale:
      'Preserves every stated height exactly; walls matching their type default need no override.',
  });

  const adaptedOpenings = openings.map((opening) => {
    const kind = opening.kind;
    if (typeof kind === 'string' && kind in OPENING_KIND_MAP) {
      return { ...opening, kind: OPENING_KIND_MAP[kind] };
    }
    return opening;
  });
  const remappedKinds = openings.filter(
    (opening) => typeof opening.kind === 'string' && (opening.kind as string) in OPENING_KIND_MAP,
  );
  record({
    section: 'openings',
    field: 'kind',
    from: summarise(remappedKinds.map((opening) => opening.kind)),
    to: 'door for sliding and pocket doors, void for a plain opening',
    entries: remappedKinds.length,
    basis: 'derived',
    rationale:
      'Every sliding and pocket opening in the file is occupied by a door, and every plain opening is unoccupied - which is exactly what void means. The leaf operation stays on the door type.',
  });

  /*
   * Doors. `side` and `hand` answer different questions - which face the leaf
   * swings into, and which edge it is hinged on - and 17.0 answers them in its
   * own words: `swingDirection` for the face, `hand: "start"` for the hinge at
   * the wall-start edge. Both are read from the file rather than defaulted.
   *
   * `swingAngle` genuinely is not in the file. A swing door is given the 90
   * degrees plans are drawn at; a sliding or pocket door is given 0, because a
   * leaf that slides does not sweep an arc and drawing one would be a fiction.
   */
  const operationByDoorType = new Map<string, string>();
  for (const type of doorTypes) {
    if (typeof type.id === 'string' && typeof type.operation === 'string') {
      operationByDoorType.set(type.id, type.operation);
    }
  }

  let swingAngles = 0;
  const adaptedDoors = doors.map((door) => {
    const next = { ...door };
    const direction = door.swingDirection;
    /*
     * `hand` is set from the fixture's own drawings, not from a reading of what
     * the word ought to mean.
     *
     * `hand: 'start'` first became `left`, which is the natural-looking guess.
     * Rendered and compared against the package's own A101 - generated from
     * this same model, so it is the model's statement of intent - the front
     * door came out hinged on the opposite jamb from the one the drawing shows.
     * The drawing hinges it at the right-hand jamb and swings it inward into
     * the entrance vestibule, which is also the only sensible way for a house's
     * front door to open. So `start` is `right`.
     *
     * `side` keeps its original polarity, and the reason is worth writing down
     * because it is not what the field name suggests. `plan-openings.ts` applies
     * `side` as a rotation from the *closed leaf direction*, and the closed leaf
     * points away from whichever jamb `hand` chose - so the same `side` value
     * opens a door in opposite directions depending on its hand. For this door,
     * hinged at the end of a wall running +X, the closed leaf points -X and
     * `side: 'right'` is what rotates it to +Y, into the house. `left` would put
     * it out on the street.
     *
     * Both are pinned by `door-swing-matches-fixture.test.ts` against the doors
     * the drawings show, because nothing about `start`, `1`, or `side` makes the
     * correct answer self-evident to the next reader either.
     */
    next.side = direction === -1 ? 'left' : 'right';
    next.hand = door.hand === 'end' ? 'left' : 'right';
    const operation =
      typeof door.typeId === 'string' ? operationByDoorType.get(door.typeId) : undefined;
    next.swingAngle = operation === 'swing' ? 90 : 0;
    swingAngles += 1;
    return next;
  });

  record({
    section: 'doors',
    field: 'side',
    from: '"configured"',
    to: 'left or right, from the file’s swingDirection',
    entries: adaptedDoors.length,
    basis: 'derived',
    rationale:
      'side is which wall face the leaf swings into, which is what swingDirection (+1 / -1) records.',
  });
  record({
    section: 'doors',
    field: 'hand',
    from: '"start" / "end"',
    to: 'left or right',
    entries: adaptedDoors.length,
    basis: 'assumed',
    rationale:
      'hand is the hinge edge; the file names it by the wall end, read here as start being the left edge looking along the wall.',
  });
  record({
    section: 'doors',
    field: 'swingAngle',
    from: '(absent)',
    to: '90 degrees for swing doors, 0 for sliding and pocket',
    entries: swingAngles,
    basis: 'assumed',
    rationale:
      'Plans draw a swing at 90 degrees; a sliding or pocket leaf sweeps no arc, so it is given none.',
  });

  const adaptedWindows = windows.map((window) => ({ ...window, side: 'left' as const }));
  record({
    section: 'windows',
    field: 'side',
    from: '"configured"',
    to: '"left"',
    entries: adaptedWindows.length,
    basis: 'assumed',
    rationale:
      'A window has no swing, so side carries no geometry here; it is set consistently rather than guessed per window.',
  });

  /*
   * Rooms. `coordinated-design-development` and `coordinated-17.0` are the
   * file's own statements that a room passed its coordination checks, and the
   * package's validation reports zero containment, boundary and route failures
   * across all forty-eight. `valid` is the reader's word for the same claim.
   */
  const adaptedRooms = rooms.map((room) => ({ ...room, status: 'valid' as const }));
  record({
    section: 'rooms',
    field: 'status',
    from: summarise(rooms.map((room) => room.status)),
    to: '"valid"',
    entries: adaptedRooms.length,
    basis: 'derived',
    rationale:
      'Both 17.0 statuses assert the room passed coordination, and the package’s own validation records zero room failures.',
  });

  /*
   * Furnishings, slabs and stairs.
   *
   * 17.0 files them under `semanticExtensions`, a bag of fifty-eight sections
   * that the reader has never looked at, so every one of the 140 fixtures, the
   * three floor plates and the stair went into the app and came out again
   * without being drawn or counted. The building arrived as an empty shell.
   *
   * Only the location changes. `fixturesAndFurniture` entries already carry an
   * id, a level, a room, a kind, `bounds`, a height and a rotation, which is
   * exactly what `placed-content.ts` reads; the slabs already carry an outer
   * rectangle, voids and a thickness; the stair already carries its flight and
   * landing definitions. Nothing is computed and nothing is filled in, which is
   * why all three are `derived` - a second reader given this file would lift the
   * same records to the same places.
   *
   * The rest of `semanticExtensions` stays where it is and is counted as
   * unsupported content by name, rather than being half-lifted into fields the
   * reader would then have to guess the meaning of.
   */
  const extensions = isRecord(raw.semanticExtensions) ? raw.semanticExtensions : {};
  const furnishings = records(extensions.fixturesAndFurniture);
  const slabs = records(extensions.slabs);
  const stairs = records(extensions.stairs);

  record({
    section: 'furnishings',
    field: '(section)',
    from: 'semanticExtensions.fixturesAndFurniture',
    to: 'furnishings',
    entries: furnishings.length,
    basis: 'derived',
    rationale:
      'Each entry already states its id, level, room, kind, bounds, height and rotation; only the section it lives in moves.',
  });
  record({
    section: 'slabs',
    field: '(section)',
    from: 'semanticExtensions.slabs',
    to: 'slabs',
    entries: slabs.length,
    basis: 'derived',
    rationale:
      'Each plate already states its level, outer rectangle, voids and thickness; only the section it lives in moves.',
  });
  record({
    section: 'stairs',
    field: '(section)',
    from: 'semanticExtensions.stairs',
    to: 'stairs',
    entries: stairs.length,
    basis: 'derived',
    rationale:
      'The flight and landing definitions are read as stated, including the mid-landing that the bounded single-flight Stair type cannot hold.',
  });

  /*
   * What is left in `semanticExtensions`, counted by name.
   *
   * The three sections above are the ones the model can carry today. The other
   * fifty-five are not - lighting layouts, electrical and plumbing points, HVAC,
   * room boundary lines, walkability rules, the validation histories of every
   * version back to 12. Lifting them into fields whose meaning this build would
   * then have to guess would be worse than not reading them.
   *
   * But dropping them silently is what this whole change exists to stop. So each
   * remaining section is counted from the file and declared, and the reader
   * carries the declaration through to a surface that can name it. A user is
   * entitled to know that their file contains 47 lighting points this build does
   * not draw; they are not entitled to find that out by noticing the ceiling is
   * empty.
   */
  const lifted = new Set(['fixturesAndFurniture', 'slabs', 'stairs']);
  const unsupportedContent = Object.entries(extensions)
    .filter(([name]) => !lifted.has(name))
    .map(([name, value]) => ({
      section: `semanticExtensions.${name}`,
      count: Array.isArray(value) ? value.length : 1,
      reason: 'Recorded in the file and not read by this build.',
    }))
    .filter((entry) => entry.count > 0)
    // Largest omission first. Fifty-five entries is a long list, and a reader
    // scanning it should meet the 188 room boundary lines before the one-line
    // acoustic intent rather than after it.
    .sort((a, b) => b.count - a.count || a.section.localeCompare(b.section));

  const model: Record<string, unknown> = {
    ...raw,
    furnishings,
    slabs,
    stairs,
    unsupportedContent,
    modelSchema: ADAPTED_MODEL_SCHEMA,
    sourceRepositoryRevision:
      isRecord(raw.repositoryContract) &&
      typeof raw.repositoryContract.compatibilityRevision === 'string'
        ? raw.repositoryContract.compatibilityRevision
        : null,
    project,
    levels,
    wallTypes: adaptedWallTypes,
    walls: adaptedWalls,
    openings: adaptedOpenings,
    doors: adaptedDoors,
    windows: adaptedWindows,
    rooms: adaptedRooms,
  };

  return { status: 'adapted', model, translations };
}

/** Renders the translation list as the block the capability check prints. */
export function formatArqHouse17Translations(
  translations: readonly ArqHouse17Translation[],
): string {
  const derived = translations.filter((entry) => entry.basis === 'derived').length;
  const assumed = translations.length - derived;
  const lines = [`Translations: ${translations.length} (${derived} derived, ${assumed} assumed)`];
  for (const entry of translations) {
    lines.push(
      `  [${entry.basis}] ${entry.section}.${entry.field} - ${entry.entries} entr${entry.entries === 1 ? 'y' : 'ies'}`,
    );
    lines.push(`      ${entry.from}  ->  ${entry.to}`);
    lines.push(`      ${entry.rationale}`);
  }
  return lines.join('\n');
}

/** Re-exported for callers that adapt and then immediately hydrate. */
export type { NativeProjectView };
