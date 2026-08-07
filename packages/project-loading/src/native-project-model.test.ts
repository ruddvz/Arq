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
    openings: [
      {
        id: 'opening-1',
        hostWallId: 'wall-1',
        kind: 'door',
        offsetFromWallStart: { value: 400, unit: 'mm' },
        width: { value: 900, unit: 'mm' },
        sillHeight: { value: 0, unit: 'mm' },
        height: { value: 2100, unit: 'mm' },
      },
    ],
    doors: [
      {
        id: 'door-1',
        typeId: 'door-type-1',
        openingId: 'opening-1',
        levelId: 'lvl-1',
        side: 'right',
        hand: 'right',
        swingAngle: 90,
      },
    ],
    linearDimensions: [{ id: 'dim-1' }, { id: 'dim-2' }],
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
    // with two dimensions has none.
    expect(sections).toEqual(['linearDimensions:2']);
    expect(result.model.unsupported.every((entry) => entry.reason.length > 0)).toBe(true);
  });

  it('no longer calls openings and doors unsupported, because they are read', () => {
    const result = parse();

    if (result.status !== 'parsed') throw new Error('expected a parsed model');
    // A warning about content that is in fact drawn is worse than no warning:
    // it teaches a user to ignore the ones that are real.
    expect(result.model.unsupported.map((entry) => entry.section)).not.toContain('openings');
    expect(result.model.unsupported.map((entry) => entry.section)).not.toContain('doors');
    expect(result.model.openings).toHaveLength(1);
    expect(result.model.doors).toHaveLength(1);
    expect(result.model.openings[0]?.width).toEqual({ value: 900, unit: 'mm' });
  });

  describe('hosted openings', () => {
    it('refuses an opening whose host wall is not defined, because it has no position at all', () => {
      const result = parse((m) => {
        (m.openings as Record<string, unknown>[])[0]!.hostWallId = 'wall-missing';
      });
      expect(result.status).toBe('rejected');
    });

    it('refuses an opening that runs past the end of its host wall', () => {
      // wall-1 is 5000 mm long in this fixture; 4500 + 900 overruns it.
      const result = parse((m) => {
        (m.openings as Record<string, unknown>[])[0]!.offsetFromWallStart = {
          value: 4500,
          unit: 'mm',
        };
      });
      expect(result.status).toBe('rejected');
      if (result.status === 'rejected') expect(result.reason).toContain('past the end of wall');
    });

    it('accepts an opening that ends exactly at the wall end, within rounding', () => {
      const result = parse((m) => {
        (m.openings as Record<string, unknown>[])[0]!.offsetFromWallStart = {
          value: 4100.05,
          unit: 'mm',
        };
      });
      expect(result.status).toBe('parsed');
    });

    it('refuses a door pointing at an opening that is not defined', () => {
      const result = parse((m) => {
        (m.doors as Record<string, unknown>[])[0]!.openingId = 'opening-missing';
      });
      expect(result.status).toBe('rejected');
    });

    it('refuses two instances occupying one opening', () => {
      const result = parse((m) => {
        m.windows = [
          {
            id: 'win-1',
            typeId: 'window-type-1',
            openingId: 'opening-1',
            levelId: 'lvl-1',
            side: 'right',
          },
        ];
      });
      expect(result.status).toBe('rejected');
      if (result.status === 'rejected') expect(result.reason).toContain('occupied by both');
    });

    it('refuses a swing angle that would sweep back through the wall', () => {
      const result = parse((m) => {
        (m.doors as Record<string, unknown>[])[0]!.swingAngle = 270;
      });
      expect(result.status).toBe('rejected');
    });

    it('refuses a zero-width opening, which cuts nothing and draws nothing', () => {
      const result = parse((m) => {
        (m.openings as Record<string, unknown>[])[0]!.width = { value: 0, unit: 'mm' };
      });
      expect(result.status).toBe('rejected');
    });

    it('reads a project that has no openings at all, which is what this build writes', () => {
      const result = parse((m) => {
        delete m.openings;
        delete m.doors;
      });
      expect(result.status).toBe('parsed');
      if (result.status !== 'parsed') return;
      expect(result.model.openings).toEqual([]);
    });
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
