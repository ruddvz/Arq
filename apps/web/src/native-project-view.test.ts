import { describe, expect, it } from 'vitest';
import { parseNativeProjectModel, type NativeProjectModel } from '@arq/project-loading';
import {
  buildNativeAccessibleDescription,
  buildNativeInspectorGroups,
  buildNativeProjectTree,
  findNativeElement,
  nativeProjectNotices,
  type OpenNativeProject,
  nativeSelectionTypeName,
  planRoomsForLevel,
  planWallsForLevel,
  resolvedWallHeightMm,
  wallThicknessMm,
} from './native-project-view';

function model(): NativeProjectModel {
  const parsed = parseNativeProjectModel({
    modelSchema: 'arq-bim-core-reference-v0',
    project: {
      id: 'proj-1',
      name: 'Courtyard House',
      units: 'metric',
      revision: 191,
      levelIds: ['lvl-gf', 'lvl-uf'],
    },
    levels: [
      { id: 'lvl-gf', name: 'Ground floor', elevation: 0, storeyHeight: 3200 },
      { id: 'lvl-uf', name: 'Upper floor', elevation: 3200 },
    ],
    wallTypes: [
      {
        id: 'type-ext',
        name: 'Exterior 250 mm',
        thickness: { value: 250, unit: 'mm' },
        defaultHeight: { value: 3, unit: 'm' },
        function: 'exterior',
      },
    ],
    walls: [
      {
        id: 'w-gf-south',
        typeId: 'type-ext',
        levelId: 'lvl-gf',
        start: { x: 0, y: 0 },
        end: { x: 12000, y: 0 },
        alignment: 'centre',
        joinStart: 'auto',
        joinEnd: 'auto',
        hostedOpeningIds: ['opening-1', 'opening-2'],
      },
      {
        id: 'w-uf-north',
        typeId: 'type-ext',
        levelId: 'lvl-uf',
        start: { x: 0, y: 8400 },
        end: { x: 4400, y: 8400 },
        alignment: 'centre',
        joinStart: 'auto',
        joinEnd: 'auto',
        heightOverride: { value: 2700, unit: 'mm' },
        hostedOpeningIds: [],
      },
    ],
    rooms: [
      {
        id: 'rm-gf-living',
        levelId: 'lvl-gf',
        seedPoint: { x: 2200, y: 2750 },
        name: 'Living',
        number: '01',
        boundaryElementIds: ['w-gf-south'],
        calculatedBoundary: [
          { x: 0, y: 0 },
          { x: 4400, y: 0 },
          { x: 4400, y: 5500 },
          { x: 0, y: 5500 },
        ],
        calculatedArea: 24.2,
        status: 'valid',
      },
      {
        id: 'rm-gf-unbounded',
        levelId: 'lvl-gf',
        seedPoint: { x: 9000, y: 9000 },
        name: 'Store',
        boundaryElementIds: [],
        calculatedBoundary: [],
        calculatedArea: 0,
        status: 'not-enclosed',
      },
    ],
    openings: [{ id: 'opening-1' }, { id: 'opening-2' }],
    doors: [{ id: 'd-1' }],
  });
  if (parsed.status !== 'parsed') {
    throw new Error(`fixture model did not parse: ${parsed.reason}`);
  }
  return parsed.model;
}

function stagedFrom(nativeModel: NativeProjectModel): OpenNativeProject {
  return {
    model: nativeModel,
    writeVerdict: 'read-only',
    writeReason: 'This build opens a .arq project for inspection only.',
    conditions: [],
  };
}

describe('native project projection', () => {
  it('feeds plan and 3D from the level on show, using the project canonical ids', () => {
    const walls = planWallsForLevel(model(), 'lvl-gf');

    expect(walls.map((wall) => wall.id)).toEqual(['w-gf-south']);
    // The same id the model tree and the inspector use, which is what makes plan
    // and 3D unable to disagree about what is selected.
    expect(walls[0]?.start).toEqual({ x: 0, y: 0 });
  });

  it('draws only rooms whose boundary is a polygon, and labels them from the project', () => {
    const rooms = planRoomsForLevel(model(), 'lvl-gf');

    expect(rooms).toHaveLength(1);
    expect(rooms[0]?.id).toBe('rm-gf-living');
    expect(rooms[0]?.label).toBe('01 Living · 24.20 m²');
  });

  it('resolves a wall height through its type unless the wall overrides it', () => {
    const nativeModel = model();
    const [south, upper] = nativeModel.walls;

    // Declared in metres on the type, resolved in millimetres.
    expect(resolvedWallHeightMm(nativeModel, south!)).toBe(3000);
    expect(wallThicknessMm(nativeModel, south!)).toBe(250);
    // The wall's own override wins over the type default.
    expect(resolvedWallHeightMm(nativeModel, upper!)).toBe(2700);
  });

  it('builds a tree of the project, its levels and their contents', () => {
    const tree = buildNativeProjectTree(model());

    expect(tree).toHaveLength(1);
    const project = tree[0]!;
    expect(project.id).toBe('proj-1');
    expect(project.displayName).toBe('Courtyard House');
    expect(project.children?.map((level) => level.id)).toEqual(['lvl-gf', 'lvl-uf']);
    const groundFloor = project.children![0]!;
    // Both walls and rooms, including the room with no drawable boundary: it
    // exists in the project, so it is listed even though the plan cannot draw it.
    expect(groundFloor.children?.map((node) => node.id)).toEqual([
      'w-gf-south',
      'rm-gf-living',
      'rm-gf-unbounded',
    ]);
    expect(groundFloor.children![0]!.displayName).toBe('Exterior 250 mm · 12000 mm');
  });

  it('resolves a selection id to the element it names, or to nothing', () => {
    const nativeModel = model();

    expect(findNativeElement(nativeModel, 'w-gf-south')?.kind).toBe('wall');
    expect(findNativeElement(nativeModel, 'rm-gf-living')?.kind).toBe('room');
    expect(findNativeElement(nativeModel, 'lvl-uf')?.kind).toBe('level');
    expect(findNativeElement(nativeModel, 'proj-1')?.kind).toBe('project');
    // A stale id from a previously open project resolves to nothing rather than
    // to a plausible element.
    expect(findNativeElement(nativeModel, 'w-from-another-project')).toBeNull();
    expect(findNativeElement(nativeModel, null)).toBeNull();
    expect(nativeSelectionTypeName(null)).toBeNull();
  });

  it('shows a wall real identity, geometry, type and hosted openings', () => {
    const nativeModel = model();
    const groups = buildNativeInspectorGroups(
      nativeModel,
      findNativeElement(nativeModel, 'w-gf-south'),
    );
    const byId = new Map(groups.map((group) => [group.id, group]));

    const identity = byId.get('identity')!.content;
    expect(identity.kind).toBe('fields');
    if (identity.kind !== 'fields') return;
    expect(identity.fields.map((field) => [field.key, field.displayValue])).toEqual([
      ['ID', 'w-gf-south'],
      ['Category', 'Wall'],
      // The level's name, not its id: the id is not what an architect calls it.
      ['Level', 'Ground floor'],
      ['Alignment', 'centre'],
    ]);

    const geometry = byId.get('geometry')!.content;
    if (geometry.kind !== 'fields') throw new Error('expected geometry fields');
    const height = geometry.fields.find((field) => field.key === 'height')!;
    // Inherited, not flattened: the height comes from the type, and the inspector
    // says so and names the source.
    expect(height.kind).toBe('inherited');
    expect(height.displayValue).toBe('3000mm');
    expect(height.sourceLabel).toBe('type-ext');

    const type = byId.get('type')!.content;
    if (type.kind !== 'fields') throw new Error('expected type fields');
    expect(type.fields.map((field) => field.displayValue)).toEqual([
      'Exterior 250 mm',
      '250mm',
      '3000mm',
      'exterior',
    ]);

    const relationships = byId.get('relationships')!.content;
    if (relationships.kind !== 'fields') throw new Error('expected relationship fields');
    expect(relationships.fields[0]?.displayValue).toBe('opening-1, opening-2');
  });

  it('reports a room own boundary status rather than assuming it is valid', () => {
    const nativeModel = model();
    const groups = buildNativeInspectorGroups(
      nativeModel,
      findNativeElement(nativeModel, 'rm-gf-unbounded'),
    );
    const warnings = groups.find((group) => group.id === 'warnings')!.content;

    if (warnings.kind !== 'lines') throw new Error('expected warning lines');
    expect(warnings.lines).toEqual(['warning: room boundary is not-enclosed']);
  });

  it('announces a selection with its real measurements and its read-only state', () => {
    const nativeModel = model();

    const wall = buildNativeAccessibleDescription(
      nativeModel,
      findNativeElement(nativeModel, 'w-gf-south'),
    );

    expect(wall).toContain('12000 millimetres');
    expect(wall).toContain('2 hosted openings');
    expect(wall).toContain('read-only');
    expect(buildNativeAccessibleDescription(nativeModel, null)).toBeNull();
  });

  it('lists everything the build does not show, counted from the project', () => {
    const notices = nativeProjectNotices(stagedFrom(model()));

    expect(notices[0]).toContain('inspection only');
    // The counts are the file's, so a project with one door never reads as a
    // project with no doors.
    expect(notices.some((notice) => notice.startsWith('2 openings'))).toBe(true);
    expect(notices.some((notice) => notice.startsWith('1 doors'))).toBe(true);
  });
});
