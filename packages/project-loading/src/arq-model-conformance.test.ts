import { describe, expect, it } from 'vitest';
import { checkArqModelConformance, formatArqModelConformanceReport } from './arq-model-conformance';

/**
 * The conforming shape, matching `fixtures/ARQ_Courtyard_House_Golden_Fixture_v2.arq`'s
 * own `model.json` vocabulary rather than an invented one, so "conforming" here
 * means the same thing it means to a real file this repository ships.
 */
function conformingModel(): Record<string, unknown> {
  return {
    modelSchema: 'arq-bim-core-reference-v0+fixture-v2',
    sourceRepositoryRevision: 'abc123',
    project: {
      schemaVersion: 0,
      id: 'proj-1',
      name: 'Reference project',
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
    windows: [],
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
  };
}

/**
 * The non-conforming shape, taken from the vocabulary the shipped ARQ House 17.0
 * `house.arq` actually uses: a flat project record, unit-less lengths, and
 * domain words (`union-solid`, `configured`, `coordinated-17.0`) where the
 * reader expects its own closed sets. Kept as a fixture so the divergences that
 * file exercises stay covered even without the file present.
 */
function house17ShapedModel(): Record<string, unknown> {
  return {
    id: 'arq-project-1',
    name: 'House',
    revision: 670,
    units: 'mm',
    levels: [{ id: 'level-ground', name: 'Ground Floor', elevation: 0, storeyHeight: 3200 }],
    wallTypes: [{ id: 'wall-type-exterior-300', name: 'Exterior wall 300 mm', width: 300 }],
    walls: [
      {
        id: 'gf-outer-south',
        typeId: 'wall-type-exterior-300',
        levelId: 'level-ground',
        start: { x: 150, y: 150 },
        end: { x: 17850, y: 150 },
        alignment: 'centre',
        joinStart: 'union-solid',
        joinEnd: 'union-solid',
        height: 3000,
        hostedOpeningIds: ['op-gf-entry'],
      },
    ],
    openings: [
      {
        id: 'op-gf-entry',
        hostWallId: 'gf-outer-south',
        kind: 'sliding-door',
        offsetFromWallStart: { value: 7950, unit: 'mm' },
        width: { value: 1800, unit: 'mm' },
        sillHeight: { value: 0, unit: 'mm' },
        height: { value: 2700, unit: 'mm' },
      },
    ],
    doors: [
      {
        id: 'd-gf-entry',
        typeId: 'door-double-1800',
        openingId: 'op-gf-entry',
        levelId: 'level-ground',
        side: 'configured',
        hand: 'start',
        swingDirection: 1,
      },
    ],
    windows: [
      {
        id: 'w-gf-study-s',
        typeId: 'window-study-2400',
        openingId: 'op-gf-entry',
        levelId: 'level-ground',
        side: 'configured',
      },
    ],
    rooms: [
      {
        id: 'rm-gf-study',
        levelId: 'level-ground',
        seedPoint: { x: 2400, y: 1900 },
        name: 'Study and office',
        number: 'G01',
        boundaryElementIds: ['bnd-1'],
        calculatedBoundary: [
          { x: 300, y: 300 },
          { x: 4500, y: 300 },
        ],
        calculatedArea: 13.44,
        status: 'coordinated-17.0',
      },
    ],
  };
}

function findingFor(
  report: ReturnType<typeof checkArqModelConformance>,
  section: string,
  field: string,
) {
  return report.findings.find((finding) => finding.section === section && finding.field === field);
}

describe('checkArqModelConformance', () => {
  it('reports a conforming model as hydrating, with no divergences', () => {
    const report = checkArqModelConformance(conformingModel());

    expect(report.readerVerdict).toBe('parsed');
    expect(report.hydrates).toBe(true);
    expect(report.findings).toEqual([]);
    expect(report.consistentWithReader).toBe(true);
  });

  it('counts the elements a conforming model declares', () => {
    const report = checkArqModelConformance(conformingModel());

    expect(report.declaredCounts).toEqual({
      levels: 1,
      wallTypes: 1,
      walls: 1,
      rooms: 1,
      openings: 1,
      doors: 1,
      windows: 0,
    });
  });

  /**
   * The point of the module: one pass names every divergence, where the reader
   * names only the first. If this ever collapses back to a single finding, the
   * report has stopped being worth running.
   */
  it('enumerates every divergence in one pass rather than stopping at the first', () => {
    const report = checkArqModelConformance(house17ShapedModel());

    expect(report.hydrates).toBe(false);
    expect(report.consistentWithReader).toBe(true);

    const located = report.findings.map((finding) => `${finding.section}.${finding.field}`);
    expect(located).toEqual(
      expect.arrayContaining([
        'model.modelSchema',
        'model.project',
        'wallTypes.thickness',
        'wallTypes.defaultHeight',
        'wallTypes.function',
        'walls.joinStart',
        'walls.joinEnd',
        'walls.height',
        'openings.kind',
        'doors.side',
        'doors.hand',
        'doors.swingAngle',
        'windows.side',
        'rooms.status',
      ]),
    );
  });

  it('names where a flat project record was found instead of a nested one', () => {
    const finding = findingFor(checkArqModelConformance(house17ShapedModel()), 'model', 'project');

    expect(finding?.found).toContain('top level');
    expect(finding?.severity).toBe('blocking');
  });

  it('reports the file vocabulary a divergent field actually uses', () => {
    const report = checkArqModelConformance(house17ShapedModel());

    expect(findingFor(report, 'walls', 'joinStart')?.found).toContain('union-solid');
    expect(findingFor(report, 'doors', 'side')?.found).toContain('configured');
    expect(findingFor(report, 'rooms', 'status')?.found).toContain('coordinated-17.0');
  });

  /**
   * A wall height the reader does not read is not a refusal - the wall draws, at
   * the wrong height. Separating that from the blocking set is what stops a
   * report claiming an openable file is unopenable.
   */
  it('separates content that is silently lost from content that blocks opening', () => {
    const report = checkArqModelConformance(house17ShapedModel());

    expect(findingFor(report, 'walls', 'height')?.severity).toBe('lossy');
    expect(findingFor(report, 'walls', 'joinStart')?.severity).toBe('blocking');
  });

  it('counts how many entries each divergence affects', () => {
    const model = house17ShapedModel();
    const walls = model.walls as Record<string, unknown>[];
    walls.push({ ...walls[0], id: 'gf-outer-north' }, { ...walls[0], id: 'gf-outer-east' });

    expect(findingFor(checkArqModelConformance(model), 'walls', 'joinStart')?.affectedEntries).toBe(
      3,
    );
  });

  it('still counts declared elements for a model that does not hydrate', () => {
    const report = checkArqModelConformance(house17ShapedModel());

    expect(report.hydrates).toBe(false);
    expect(report.declaredCounts.walls).toBe(1);
    expect(report.declaredCounts.openings).toBe(1);
  });

  it('reports the reader’s own rejection reason verbatim', () => {
    const report = checkArqModelConformance(house17ShapedModel());

    expect(report.readerVerdict).toBe('rejected');
    expect(report.readerReason).toBe('model.json does not declare a modelSchema');
  });

  it('refuses a document that is not an object', () => {
    const report = checkArqModelConformance('not a model');

    expect(report.hydrates).toBe(false);
    expect(report.findings).toHaveLength(1);
    expect(report.consistentWithReader).toBe(true);
  });

  /**
   * Anti-drift guard. Every mutation below is one the real reader rejects; each
   * must also produce a blocking finding here. When native-project-model.ts
   * tightens or loosens a rule and this module is not updated with it, one of
   * these fails rather than the checker quietly giving wrong advice.
   */
  it.each([
    ['modelSchema', (m: Record<string, unknown>) => delete m.modelSchema],
    [
      'unknown modelSchema',
      (m: Record<string, unknown>) => (m.modelSchema = 'some-other-schema-v9'),
    ],
    ['project record', (m: Record<string, unknown>) => delete m.project],
    [
      'units',
      (m: Record<string, unknown>) => ((m.project as Record<string, unknown>).units = 'mm'),
    ],
    [
      'wall type thickness',
      (m: Record<string, unknown>) =>
        ((m.wallTypes as Record<string, unknown>[])[0]!.thickness = 250),
    ],
    [
      'wall type function',
      (m: Record<string, unknown>) =>
        ((m.wallTypes as Record<string, unknown>[])[0]!.function = 'structural'),
    ],
    [
      'wall join intent',
      (m: Record<string, unknown>) =>
        ((m.walls as Record<string, unknown>[])[0]!.joinStart = 'union-solid'),
    ],
    [
      'wall alignment',
      (m: Record<string, unknown>) =>
        ((m.walls as Record<string, unknown>[])[0]!.alignment = 'core-face'),
    ],
    [
      'opening kind',
      (m: Record<string, unknown>) =>
        ((m.openings as Record<string, unknown>[])[0]!.kind = 'pocket-door'),
    ],
    [
      'door side',
      (m: Record<string, unknown>) =>
        ((m.doors as Record<string, unknown>[])[0]!.side = 'configured'),
    ],
    [
      'door swing angle',
      (m: Record<string, unknown>) => delete (m.doors as Record<string, unknown>[])[0]!.swingAngle,
    ],
    [
      'room status',
      (m: Record<string, unknown>) =>
        ((m.rooms as Record<string, unknown>[])[0]!.status = 'coordinated-17.0'),
    ],
  ])('stays consistent with the real reader when %s diverges', (_label, mutate) => {
    const model = conformingModel();
    mutate(model);
    const report = checkArqModelConformance(model);

    expect(report.readerVerdict).toBe('rejected');
    expect(report.findings.some((finding) => finding.severity === 'blocking')).toBe(true);
    expect(report.consistentWithReader).toBe(true);
  });
});

describe('formatArqModelConformanceReport', () => {
  it('states the verdict, the counts and each divergence', () => {
    const text = formatArqModelConformanceReport(checkArqModelConformance(house17ShapedModel()));

    expect(text).toContain('Reader verdict: rejected');
    expect(text).toContain('Hydrates in this build: no');
    expect(text).toContain('walls 1');
    expect(text).toContain('[blocking] model.modelSchema');
  });

  it('says so plainly when a model has no divergences', () => {
    const text = formatArqModelConformanceReport(checkArqModelConformance(conformingModel()));

    expect(text).toContain('Hydrates in this build: yes');
    expect(text).toContain('No contract divergences found.');
  });
});
