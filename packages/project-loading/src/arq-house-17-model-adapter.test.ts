import { describe, expect, it } from 'vitest';
import {
  adaptArqHouse17Model,
  formatArqHouse17Translations,
  type ArqHouse17Translation,
} from './arq-house-17-model-adapter';
import { checkArqModelConformance } from './arq-model-conformance';
import { parseNativeProjectModel } from './native-project-model';

/**
 * A miniature of the real ARQ House 17.0 `model.json`: the same flat project
 * record, bare wall-type widths, `union-solid` joins, per-wall heights,
 * `sliding-door` / `pocket-door` / `opening` kinds, `configured` sides and
 * `coordinated-*` room statuses. Small enough to reason about, faithful enough
 * that every translation the real file exercises is exercised here too.
 */
function house17Model(): Record<string, unknown> {
  return {
    id: 'arq-project-house',
    name: 'House',
    revision: 670,
    units: 'mm',
    schemaVersion: 0,
    archived: false,
    levelIds: ['level-ground'],
    repositoryContract: { compatibilityRevision: 'deadbeef', schemaVersion: 2 },
    levels: [{ id: 'level-ground', name: 'Ground Floor', elevation: 0, storeyHeight: 3200 }],
    wallTypes: [
      { id: 'wt-exterior-300', name: 'Exterior wall 300 mm', width: 300 },
      { id: 'wt-interior-150', name: 'Interior partition 150 mm', width: 150 },
    ],
    walls: [
      {
        id: 'w-south',
        typeId: 'wt-exterior-300',
        levelId: 'level-ground',
        start: { x: 0, y: 0 },
        end: { x: 10000, y: 0 },
        alignment: 'centre',
        joinStart: 'union-solid',
        joinEnd: 'union-solid',
        semanticRole: 'outer-envelope',
        height: 3000,
        hostedOpeningIds: ['op-entry', 'op-slide', 'op-void', 'op-win'],
      },
      {
        id: 'w-parapet',
        typeId: 'wt-exterior-300',
        levelId: 'level-ground',
        start: { x: 0, y: 4000 },
        end: { x: 10000, y: 4000 },
        alignment: 'centre',
        joinStart: 'union-solid',
        joinEnd: 'union-solid',
        semanticRole: 'courtyard-parapet',
        height: 1100,
        hostedOpeningIds: [],
      },
      {
        id: 'w-partition',
        typeId: 'wt-interior-150',
        levelId: 'level-ground',
        start: { x: 2000, y: 0 },
        end: { x: 2000, y: 4000 },
        alignment: 'centre',
        joinStart: 'union-solid',
        joinEnd: 'union-solid',
        semanticRole: 'partition',
        height: 3000,
        hostedOpeningIds: ['op-pocket'],
      },
      // The corner-join segment: no alignment, no join intent, no role, no height.
      {
        id: 'w-corner-join',
        typeId: 'wt-interior-150',
        levelId: 'level-ground',
        start: { x: 2000, y: 4000 },
        end: { x: 2600, y: 4000 },
        hostedOpeningIds: [],
      },
    ],
    openings: [
      {
        id: 'op-entry',
        hostWallId: 'w-south',
        kind: 'door',
        levelId: 'level-ground',
        offsetFromWallStart: { value: 500, unit: 'mm' },
        width: { value: 900, unit: 'mm' },
        sillHeight: { value: 0, unit: 'mm' },
        height: { value: 2100, unit: 'mm' },
      },
      {
        id: 'op-slide',
        hostWallId: 'w-south',
        kind: 'sliding-door',
        levelId: 'level-ground',
        offsetFromWallStart: { value: 2000, unit: 'mm' },
        width: { value: 1800, unit: 'mm' },
        sillHeight: { value: 0, unit: 'mm' },
        height: { value: 2400, unit: 'mm' },
      },
      {
        id: 'op-void',
        hostWallId: 'w-south',
        kind: 'opening',
        levelId: 'level-ground',
        offsetFromWallStart: { value: 5000, unit: 'mm' },
        width: { value: 1000, unit: 'mm' },
        sillHeight: { value: 0, unit: 'mm' },
        height: { value: 2100, unit: 'mm' },
      },
      {
        id: 'op-win',
        hostWallId: 'w-south',
        kind: 'window',
        levelId: 'level-ground',
        offsetFromWallStart: { value: 7000, unit: 'mm' },
        width: { value: 1200, unit: 'mm' },
        sillHeight: { value: 900, unit: 'mm' },
        height: { value: 1400, unit: 'mm' },
      },
      {
        id: 'op-pocket',
        hostWallId: 'w-partition',
        kind: 'pocket-door',
        levelId: 'level-ground',
        offsetFromWallStart: { value: 500, unit: 'mm' },
        width: { value: 800, unit: 'mm' },
        sillHeight: { value: 0, unit: 'mm' },
        height: { value: 2100, unit: 'mm' },
      },
    ],
    doorTypes: [
      { id: 'dt-swing', name: 'Swing 900', operation: 'swing', width: 900, height: 2100 },
      { id: 'dt-slide', name: 'Slider 1800', operation: 'sliding', width: 1800, height: 2400 },
      { id: 'dt-pocket', name: 'Pocket 800', operation: 'pocket', width: 800, height: 2100 },
    ],
    windowTypes: [{ id: 'wt-win-1200', name: 'Window 1200', width: 1200, height: 1400, sill: 900 }],
    doors: [
      {
        id: 'd-entry',
        typeId: 'dt-swing',
        openingId: 'op-entry',
        levelId: 'level-ground',
        side: 'configured',
        hand: 'start',
        swingDirection: 1,
      },
      {
        id: 'd-slide',
        typeId: 'dt-slide',
        openingId: 'op-slide',
        levelId: 'level-ground',
        side: 'configured',
        hand: 'start',
        swingDirection: -1,
      },
      {
        id: 'd-pocket',
        typeId: 'dt-pocket',
        openingId: 'op-pocket',
        levelId: 'level-ground',
        side: 'configured',
        hand: 'end',
        swingDirection: 1,
      },
    ],
    windows: [
      {
        id: 'win-1',
        typeId: 'wt-win-1200',
        openingId: 'op-win',
        levelId: 'level-ground',
        side: 'configured',
      },
    ],
    rooms: [
      {
        id: 'rm-living',
        levelId: 'level-ground',
        seedPoint: { x: 5000, y: 2000 },
        name: 'Living',
        number: 'G01',
        boundaryElementIds: ['w-south'],
        calculatedBoundary: [
          { x: 0, y: 0 },
          { x: 10000, y: 0 },
          { x: 10000, y: 4000 },
        ],
        calculatedArea: 40,
        status: 'coordinated-design-development',
      },
      {
        id: 'rm-study',
        levelId: 'level-ground',
        seedPoint: { x: 1000, y: 2000 },
        name: 'Study',
        number: 'G02',
        boundaryElementIds: ['w-partition'],
        calculatedBoundary: [
          { x: 0, y: 0 },
          { x: 2000, y: 0 },
          { x: 2000, y: 4000 },
        ],
        calculatedArea: 8,
        status: 'coordinated-17.0',
      },
    ],
  };
}

function adaptOrThrow(model: Record<string, unknown>) {
  const result = adaptArqHouse17Model(model);
  if (result.status !== 'adapted') throw new Error(`not adapted: ${result.reason}`);
  return result;
}

function translationFor(
  translations: readonly ArqHouse17Translation[],
  section: string,
  field: string,
): ArqHouse17Translation | undefined {
  return translations.find((entry) => entry.section === section && entry.field.startsWith(field));
}

describe('adaptArqHouse17Model', () => {
  it('turns a model the reader refuses into one it hydrates', () => {
    const before = checkArqModelConformance(house17Model());
    expect(before.hydrates).toBe(false);

    const after = checkArqModelConformance(adaptOrThrow(house17Model()).model);

    expect(after.hydrates).toBe(true);
    expect(after.findings).toEqual([]);
  });

  it('hydrates every element the file declares, losing none', () => {
    const parsed = parseNativeProjectModel(adaptOrThrow(house17Model()).model);

    expect(parsed.status).toBe('parsed');
    if (parsed.status !== 'parsed') return;
    expect(parsed.model.levels).toHaveLength(1);
    expect(parsed.model.wallTypes).toHaveLength(2);
    expect(parsed.model.walls).toHaveLength(4);
    expect(parsed.model.openings).toHaveLength(5);
    expect(parsed.model.doors).toHaveLength(3);
    expect(parsed.model.windows).toHaveLength(1);
    expect(parsed.model.rooms).toHaveLength(2);
    expect(parsed.model.unsupported).toEqual([]);
  });

  /**
   * The translation that would otherwise be silent, and the reason the adapter
   * pairs a derived type default with per-wall overrides: every height the file
   * states has to survive, whether or not it matches its type's default.
   */
  it('preserves every stated wall height exactly', () => {
    const legacy = house17Model();
    const parsed = parseNativeProjectModel(adaptOrThrow(legacy).model);
    if (parsed.status !== 'parsed') throw new Error('rejected');

    const defaults = new Map(
      parsed.model.wallTypes.map((type) => [type.id as string, type.defaultHeight.value]),
    );
    for (const wall of legacy.walls as Record<string, unknown>[]) {
      if (typeof wall.height !== 'number') continue;
      const hydrated = parsed.model.walls.find((entry) => (entry.id as string) === wall.id)!;
      const effective = hydrated.heightOverride?.value ?? defaults.get(hydrated.typeId as string);
      expect(effective).toBe(wall.height);
    }
  });

  it('leaves wall geometry untouched', () => {
    const legacy = house17Model();
    const parsed = parseNativeProjectModel(adaptOrThrow(legacy).model);
    if (parsed.status !== 'parsed') throw new Error('rejected');

    for (const wall of legacy.walls as Record<string, unknown>[]) {
      const hydrated = parsed.model.walls.find((entry) => (entry.id as string) === wall.id)!;
      expect({ start: hydrated.start, end: hydrated.end }).toEqual({
        start: wall.start,
        end: wall.end,
      });
    }
  });

  it('reads a wall type thickness from its bare width', () => {
    const parsed = parseNativeProjectModel(adaptOrThrow(house17Model()).model);
    if (parsed.status !== 'parsed') throw new Error('rejected');

    const exterior = parsed.model.wallTypes.find((type) => type.id === 'wt-exterior-300')!;
    expect(exterior.thickness).toEqual({ value: 300, unit: 'mm' });
  });

  /**
   * Only the partition role is interior. A parapet and a courtyard frame face
   * open air, so a type used for them is exterior even though it is thin.
   */
  it('classifies wall type function from the roles of the walls using it', () => {
    const parsed = parseNativeProjectModel(adaptOrThrow(house17Model()).model);
    if (parsed.status !== 'parsed') throw new Error('rejected');

    expect(parsed.model.wallTypes.find((type) => type.id === 'wt-exterior-300')!.function).toBe(
      'exterior',
    );
    expect(parsed.model.wallTypes.find((type) => type.id === 'wt-interior-150')!.function).toBe(
      'interior',
    );
  });

  it('translates union-solid joins to the native intent that also merges', () => {
    const parsed = parseNativeProjectModel(adaptOrThrow(house17Model()).model);
    if (parsed.status !== 'parsed') throw new Error('rejected');

    for (const wall of parsed.model.walls) {
      expect(wall.joinStart).toBe('auto');
      expect(wall.joinEnd).toBe('auto');
    }
  });

  it('gives the corner-join segment the defaults every other wall states', () => {
    const parsed = parseNativeProjectModel(adaptOrThrow(house17Model()).model);
    if (parsed.status !== 'parsed') throw new Error('rejected');

    const join = parsed.model.walls.find((wall) => wall.id === 'w-corner-join')!;
    expect(join.alignment).toBe('centre');
    expect(join.joinStart).toBe('auto');
  });

  /**
   * A sliding or pocket door is still a door in the void it occupies; a plain
   * `opening` is occupied by nothing, which is exactly what `void` means.
   */
  it('maps opening kinds by what occupies them', () => {
    const parsed = parseNativeProjectModel(adaptOrThrow(house17Model()).model);
    if (parsed.status !== 'parsed') throw new Error('rejected');

    const kind = (id: string) => parsed.model.openings.find((entry) => entry.id === id)!.kind;
    expect(kind('op-slide')).toBe('door');
    expect(kind('op-pocket')).toBe('door');
    expect(kind('op-void')).toBe('void');
    expect(kind('op-win')).toBe('window');
  });

  it('reads a door side from the file’s own swing direction', () => {
    const parsed = parseNativeProjectModel(adaptOrThrow(house17Model()).model);
    if (parsed.status !== 'parsed') throw new Error('rejected');

    expect(parsed.model.doors.find((door) => door.id === 'd-entry')!.side).toBe('right');
    expect(parsed.model.doors.find((door) => door.id === 'd-slide')!.side).toBe('left');
  });

  /**
   * `start` is `right`, which is the opposite of what the words suggest and was
   * asserted the other way round here until the drawings settled it. See
   * `door-swing-matches-fixture.test.ts`: rendered against the package's own
   * A101, `start` → `left` hinged the front door on the wrong jamb. This test
   * pins the mapping; that one pins the reason.
   */
  it('reads a door hand from the wall end the file hinges it on', () => {
    const parsed = parseNativeProjectModel(adaptOrThrow(house17Model()).model);
    if (parsed.status !== 'parsed') throw new Error('rejected');

    expect(parsed.model.doors.find((door) => door.id === 'd-entry')!.hand).toBe('right');
    expect(parsed.model.doors.find((door) => door.id === 'd-pocket')!.hand).toBe('left');
  });

  /** A leaf that slides sweeps no arc, and drawing one at 90 degrees would be a fiction. */
  it('gives a swing angle only to doors that swing', () => {
    const parsed = parseNativeProjectModel(adaptOrThrow(house17Model()).model);
    if (parsed.status !== 'parsed') throw new Error('rejected');

    expect(parsed.model.doors.find((door) => door.id === 'd-entry')!.swingAngle).toBe(90);
    expect(parsed.model.doors.find((door) => door.id === 'd-slide')!.swingAngle).toBe(0);
    expect(parsed.model.doors.find((door) => door.id === 'd-pocket')!.swingAngle).toBe(0);
  });

  it('reads both coordinated room statuses as valid', () => {
    const parsed = parseNativeProjectModel(adaptOrThrow(house17Model()).model);
    if (parsed.status !== 'parsed') throw new Error('rejected');

    for (const room of parsed.model.rooms) expect(room.status).toBe('valid');
  });

  it('carries the file’s recorded repository revision onto the summary', () => {
    const parsed = parseNativeProjectModel(adaptOrThrow(house17Model()).model);
    if (parsed.status !== 'parsed') throw new Error('rejected');

    expect(parsed.model.summary.sourceRepositoryRevision).toBe('deadbeef');
    expect(parsed.model.summary.modelSchema).toBe('arq-bim-core-reference-v0+arq-house-17');
    expect(parsed.model.summary.units).toBe('metric');
    expect(parsed.model.summary.revision).toBe(670);
  });

  it('does not mutate the model it was given', () => {
    const original = house17Model();
    const snapshot = JSON.stringify(original);
    adaptOrThrow(original);

    expect(JSON.stringify(original)).toBe(snapshot);
  });
});

describe('adaptArqHouse17Model translation reporting', () => {
  it('reports every translation it made', () => {
    const { translations } = adaptOrThrow(house17Model());

    const located = translations.map((entry) => `${entry.section}.${entry.field}`);
    expect(located).toEqual(
      expect.arrayContaining([
        'model.modelSchema',
        'model.project',
        'project.units',
        'wallTypes.thickness',
        'wallTypes.defaultHeight',
        'wallTypes.function',
        'walls.alignment',
        'openings.kind',
        'doors.side',
        'doors.hand',
        'doors.swingAngle',
        'windows.side',
        'rooms.status',
      ]),
    );
  });

  /**
   * The distinction the whole module rests on. If a translation the file does
   * not support were ever reported as `derived`, a reader would take an applied
   * convention for a stated fact.
   */
  it('separates what the file states from what convention supplied', () => {
    const { translations } = adaptOrThrow(house17Model());

    expect(translationFor(translations, 'wallTypes', 'thickness')?.basis).toBe('derived');
    expect(translationFor(translations, 'doors', 'side')?.basis).toBe('derived');
    expect(translationFor(translations, 'rooms', 'status')?.basis).toBe('derived');
    expect(translationFor(translations, 'doors', 'swingAngle')?.basis).toBe('assumed');
    expect(translationFor(translations, 'windows', 'side')?.basis).toBe('assumed');
    expect(translationFor(translations, 'walls', 'alignment')?.basis).toBe('assumed');
  });

  it('gives every translation a rationale a reviewer can weigh', () => {
    for (const entry of adaptOrThrow(house17Model()).translations) {
      expect(entry.rationale.length).toBeGreaterThan(20);
      expect(entry.entries).toBeGreaterThan(0);
    }
  });

  it('counts the entries each translation applied to', () => {
    const { translations } = adaptOrThrow(house17Model());

    expect(translationFor(translations, 'rooms', 'status')?.entries).toBe(2);
    expect(translationFor(translations, 'doors', 'side')?.entries).toBe(3);
    expect(translationFor(translations, 'walls', 'alignment')?.entries).toBe(1);
  });
});

describe('adaptArqHouse17Model applicability', () => {
  it('declines a model that already conforms, rather than rewriting it', () => {
    const conforming = {
      modelSchema: 'arq-bim-core-reference-v0',
      project: { id: 'p', name: 'P', units: 'metric', revision: 1, levelIds: [] },
      levels: [],
      wallTypes: [
        {
          id: 't',
          name: 'T',
          thickness: { value: 100, unit: 'mm' },
          defaultHeight: { value: 3000, unit: 'mm' },
          function: 'interior',
        },
      ],
      walls: [],
    };

    expect(adaptArqHouse17Model(conforming).status).toBe('not-applicable');
  });

  it.each([
    ['a non-object', 'not a model'],
    ['an empty object', {}],
    ['a model with no wall types', { id: 'a', name: 'b', wallTypes: [] }],
    [
      'a model whose wall types already carry a thickness',
      {
        id: 'a',
        name: 'b',
        wallTypes: [{ id: 't', width: 100, thickness: { value: 100, unit: 'mm' } }],
      },
    ],
  ])('declines %s', (_label, value) => {
    expect(adaptArqHouse17Model(value).status).toBe('not-applicable');
  });
});

describe('formatArqHouse17Translations', () => {
  it('states the split between derived and assumed', () => {
    const text = formatArqHouse17Translations(adaptOrThrow(house17Model()).translations);

    expect(text).toMatch(/Translations: \d+ \(\d+ derived, \d+ assumed\)/);
    expect(text).toContain('[derived] wallTypes.thickness');
    expect(text).toContain('[assumed] doors.swingAngle');
  });
});

/**
 * The leftovers.
 *
 * Three of the file's 58 `semanticExtensions` sections are lifted into model
 * fields; the other 55 are not, and the point of this block is that not-lifted
 * must never mean not-mentioned. A user is entitled to know their file carries
 * 47 lighting points this build does not draw; they are not entitled to find
 * that out by noticing the ceiling is empty.
 */
describe('what the adapter leaves behind', () => {
  function modelWithExtensions(extensions: Record<string, unknown>): Record<string, unknown> {
    return {
      id: 'arq-project-house',
      name: 'House',
      revision: 670,
      units: 'mm',
      levels: [{ id: 'level-ground', name: 'Ground', elevation: 0 }],
      wallTypes: [{ id: 'wt', name: 'Wall', width: 300 }],
      walls: [],
      semanticExtensions: extensions,
    };
  }

  function inventory(extensions: Record<string, unknown>): { section: string; count: number }[] {
    const adapted = adaptArqHouse17Model(modelWithExtensions(extensions));
    if (adapted.status !== 'adapted') throw new Error('expected the model to adapt');
    return adapted.model['unsupportedContent'] as { section: string; count: number }[];
  }

  it('counts every section it did not lift, by name and quantity', () => {
    const declared = inventory({ lighting: [1, 2, 3], hvac: [1] });
    expect(declared).toEqual([
      { section: 'semanticExtensions.lighting', count: 3, reason: expect.any(String) },
      { section: 'semanticExtensions.hvac', count: 1, reason: expect.any(String) },
    ]);
  });

  it('does not report the three sections it did lift', () => {
    const declared = inventory({
      fixturesAndFurniture: [{ id: 'a' }],
      slabs: [{ id: 'b' }],
      stairs: [{ id: 'c' }],
      lighting: [1],
    });
    expect(declared.map((entry) => entry.section)).toEqual(['semanticExtensions.lighting']);
  });

  /** A section that is an object, not a list, is one thing rather than none. */
  it('counts a non-list section as one', () => {
    expect(inventory({ designIntent: { concept: 'courtyard' } })[0]?.count).toBe(1);
  });

  it('leaves an empty section out rather than reporting nothing missing', () => {
    expect(inventory({ lighting: [], hvac: [1] }).map((entry) => entry.section)).toEqual([
      'semanticExtensions.hvac',
    ]);
  });

  it('puts the largest omission first', () => {
    const declared = inventory({ acousticIntent: { a: 1 }, roomBoundaryLines: [1, 2], hvac: [1] });
    expect(declared.map((entry) => entry.count)).toEqual([2, 1, 1]);
    // Ties break by name, so the order is stable rather than whatever the file
    // happened to write first.
    expect(declared[1]?.section).toBe('semanticExtensions.acousticIntent');
  });

  it('declares nothing for a model that carries no extensions at all', () => {
    const adapted = adaptArqHouse17Model({
      id: 'p',
      name: 'P',
      units: 'mm',
      levels: [{ id: 'l', name: 'L', elevation: 0 }],
      wallTypes: [{ id: 'wt', name: 'W', width: 300 }],
      walls: [],
    });
    if (adapted.status !== 'adapted') throw new Error('expected the model to adapt');
    expect(adapted.model['unsupportedContent']).toEqual([]);
  });
});
