import { describe, expect, it } from 'vitest';
import {
  parseNativeProjectModel,
  parseNativeProjectViews,
  roomsOnLevel,
  wallTypeFor,
  wallsOnLevel,
} from './native-project-model';

/**
 * A minimal but valid project, so each test can break exactly one thing. Every
 * rejection below is a shape a real file could have - an older writer, a
 * truncated export, or a file someone edited by hand - not a hypothetical.
 */
function validModel(): Record<string, unknown> {
  return {
    modelSchema: 'arq-bim-core-reference-v0',
    sourceRepositoryRevision: 'abc123',
    project: {
      schemaVersion: 0,
      id: 'proj-1',
      name: 'Test project',
      units: 'metric',
      revision: 7,
      archived: false,
      levelIds: ['lvl-1'],
    },
    levels: [{ id: 'lvl-1', name: 'Ground floor', elevation: 0, storeyHeight: 3000 }],
    wallTypes: [
      {
        id: 'type-1',
        name: 'Exterior 250 mm',
        thickness: { value: 250, unit: 'mm' },
        defaultHeight: { value: 3, unit: 'm' },
        function: 'exterior',
      },
    ],
    walls: [
      {
        id: 'wall-1',
        typeId: 'type-1',
        levelId: 'lvl-1',
        start: { x: 0, y: 0 },
        end: { x: 5000, y: 0 },
        alignment: 'centre',
        joinStart: 'auto',
        joinEnd: 'auto',
        hostedOpeningIds: ['opening-1'],
      },
    ],
    rooms: [
      {
        id: 'room-1',
        levelId: 'lvl-1',
        seedPoint: { x: 100, y: 100 },
        name: 'Living',
        number: '01',
        boundaryElementIds: ['wall-1'],
        calculatedBoundary: [
          { x: 0, y: 0 },
          { x: 1000, y: 0 },
          { x: 1000, y: 1000 },
        ],
        calculatedArea: 1,
        status: 'valid',
      },
    ],
    openings: [{ id: 'opening-1' }],
    doors: [{ id: 'door-1' }, { id: 'door-2' }],
  };
}

function parse(mutate: (model: Record<string, unknown>) => void = () => {}) {
  const model = validModel();
  mutate(model);
  return parseNativeProjectModel(model);
}

describe('parseNativeProjectModel', () => {
  it('reads a valid project into bim-core shapes with lengths normalised to millimetres', () => {
    const result = parse();

    expect(result.status).toBe('parsed');
    if (result.status !== 'parsed') return;
    expect(result.model.summary).toEqual({
      projectId: 'proj-1',
      projectName: 'Test project',
      units: 'metric',
      revision: 7,
      modelSchema: 'arq-bim-core-reference-v0',
      sourceRepositoryRevision: 'abc123',
    });
    // Declared in metres in the file, consumed in millimetres, so no caller has
    // to redo the unit conversion (or forget to).
    expect(result.model.wallTypes[0]?.defaultHeight).toEqual({ value: 3000, unit: 'mm' });
    expect(result.model.walls[0]?.hostedOpeningIds).toEqual(['opening-1']);
  });

  it('reports content it does not display, with counts read from the file', () => {
    const result = parse();

    if (result.status !== 'parsed') throw new Error('expected a parsed model');
    const sections = result.model.unsupported.map((entry) => `${entry.section}:${entry.count}`);
    // The alternative - dropping these silently - lets a user believe a project
    // with two doors has none.
    expect(sections).toEqual(['openings:1', 'doors:2']);
    expect(result.model.unsupported.every((entry) => entry.reason.length > 0)).toBe(true);
  });

  it('accepts a schema tag with an annotation suffix but refuses an unknown base', () => {
    expect(parse((m) => (m.modelSchema = 'arq-bim-core-reference-v0+fixture-v2')).status).toBe(
      'parsed',
    );

    const unknown = parse((m) => (m.modelSchema = 'some-other-model-v3'));

    // Reading unknown field meanings hopefully is how a reader silently
    // misinterprets canonical semantics; arqfs-open.ts refuses unknown required
    // feature flags for the same reason.
    expect(unknown.status).toBe('rejected');
    if (unknown.status === 'rejected') {
      expect(unknown.reason).toContain('some-other-model-v3');
    }
  });

  it.each([
    [
      'a coordinate that is not a real number',
      (m: Record<string, unknown>) => {
        (m.walls as Record<string, unknown>[])[0]!.end = { x: Number.NaN, y: 0 };
      },
    ],
    [
      'an infinite coordinate',
      (m: Record<string, unknown>) => {
        (m.walls as Record<string, unknown>[])[0]!.end = { x: Number.POSITIVE_INFINITY, y: 0 };
      },
    ],
    [
      'a wall with no length',
      (m: Record<string, unknown>) => {
        (m.walls as Record<string, unknown>[])[0]!.end = { x: 0, y: 0 };
      },
    ],
    [
      'a wall type with zero thickness',
      (m: Record<string, unknown>) => {
        (m.wallTypes as Record<string, unknown>[])[0]!.thickness = { value: 0, unit: 'mm' };
      },
    ],
    [
      'an unrecognised alignment',
      (m: Record<string, unknown>) => {
        (m.walls as Record<string, unknown>[])[0]!.alignment = 'sideways';
      },
    ],
    [
      'an unrecognised join intent',
      (m: Record<string, unknown>) => {
        (m.walls as Record<string, unknown>[])[0]!.joinEnd = 'weld';
      },
    ],
    [
      'a wall type this project does not define',
      (m: Record<string, unknown>) => {
        (m.walls as Record<string, unknown>[])[0]!.typeId = 'type-missing';
      },
    ],
    [
      'a level this project does not define',
      (m: Record<string, unknown>) => {
        (m.walls as Record<string, unknown>[])[0]!.levelId = 'lvl-missing';
      },
    ],
    [
      'a duplicate element id',
      (m: Record<string, unknown>) => {
        (m.rooms as Record<string, unknown>[])[0]!.id = 'wall-1';
      },
    ],
    [
      'no levels at all',
      (m: Record<string, unknown>) => {
        m.levels = [];
      },
    ],
    [
      'a revision that is not a whole count',
      (m: Record<string, unknown>) => {
        (m.project as Record<string, unknown>).revision = 7.5;
      },
    ],
    [
      'units it does not recognise',
      (m: Record<string, unknown>) => {
        (m.project as Record<string, unknown>).units = 'furlongs';
      },
    ],
    [
      'a walls section that is not a list',
      (m: Record<string, unknown>) => {
        m.walls = { id: 'wall-1' };
      },
    ],
    [
      'a root that is not an object',
      (m: Record<string, unknown>) => {
        delete m.modelSchema;
      },
    ],
  ])('refuses %s', (_label, mutate) => {
    const result = parse(mutate);

    expect(result.status).toBe('rejected');
    if (result.status === 'rejected') {
      // A reason a diagnostics surface can show and a maintainer can act on,
      // not "invalid model".
      expect(result.reason.length).toBeGreaterThan(10);
    }
  });

  it('never throws on hostile input, it rejects', () => {
    for (const hostile of [null, undefined, 42, 'model', [], { modelSchema: 1 }]) {
      expect(() => parseNativeProjectModel(hostile)).not.toThrow();
      expect(parseNativeProjectModel(hostile).status).toBe('rejected');
    }
  });

  it('keeps a room whose boundary cannot be drawn in the model but out of the plan', () => {
    const result = parse((m) => {
      (m.rooms as Record<string, unknown>[])[0]!.calculatedBoundary = [{ x: 0, y: 0 }];
      (m.rooms as Record<string, unknown>[])[0]!.status = 'not-enclosed';
    });

    if (result.status !== 'parsed') throw new Error('expected a parsed model');
    // The room exists and is listed; only its undrawable polygon is withheld.
    expect(result.model.rooms).toHaveLength(1);
    expect(roomsOnLevel(result.model, 'lvl-1')).toHaveLength(0);
  });

  it('selects by level and resolves a wall to its type', () => {
    const result = parse();

    if (result.status !== 'parsed') throw new Error('expected a parsed model');
    expect(wallsOnLevel(result.model, 'lvl-1')).toHaveLength(1);
    expect(wallsOnLevel(result.model, 'lvl-2')).toHaveLength(0);
    expect(wallTypeFor(result.model, result.model.walls[0]!)?.name).toBe('Exterior 250 mm');
  });
});

describe('parseNativeProjectViews', () => {
  it('separates a kind with no surface from a view the file says is not current', () => {
    const views = parseNativeProjectViews({
      schemaVersion: 0,
      views: [
        {
          id: 'v-plan',
          name: 'Ground floor plan',
          kind: 'plan',
          levelId: 'lvl-1',
          state: 'current',
        },
        { id: 'v-3d', name: 'Axonometric', kind: '3d', state: 'current' },
        { id: 'v-section', name: 'Section A', kind: 'section', state: 'proposed-not-rendered' },
        { id: 'v-elev', name: 'Elevation', kind: 'elevation', state: 'current' },
      ],
    });

    expect(views.map((view) => [view.id, view.supported, view.unsupportedReason])).toEqual([
      ['v-plan', true, null],
      ['v-3d', true, null],
      // Two different facts. Saying "no section surface" about a view the file
      // itself never rendered would misdescribe the project.
      [
        'v-section',
        false,
        'The project records this view as "proposed-not-rendered" rather than current.',
      ],
      ['v-elev', false, 'This build has no elevation surface yet.'],
    ]);
  });

  it('treats missing or malformed view records as no views rather than a failure', () => {
    expect(parseNativeProjectViews(undefined)).toEqual([]);
    expect(parseNativeProjectViews({ views: 'nope' })).toEqual([]);
    // An entry with no id cannot be addressed, so it is skipped, not guessed at.
    expect(parseNativeProjectViews({ views: [{ kind: 'plan' }, 3, null] })).toEqual([]);
  });
});
