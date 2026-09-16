import { createManifest, exportArchive } from '../../packages/project-format/src/index';
import {
  createArqfsSchemaV1,
  createNodeArqfsDriver,
  putArchiveEntries,
} from '../../packages/arqfs/src/index';

export const CORE_WORKFLOW_FIXTURE_ID = 'core-workflow-v1';
export const CORE_WORKFLOW_PROJECT_ID = 'perf-core-workflow-v1';
export const CORE_WORKFLOW_PROJECT_NAME = 'Synthetic Core Workflow Project';
export const CORE_WORKFLOW_REVISION = 1;
export const CORE_WORKFLOW_CREATED_AT = '2026-01-01T00:00:00.000Z';

export const CORE_WORKFLOW_SCALE = Object.freeze({
  levels: 2,
  walls: 150,
  doorsAndWindows: 80,
  rooms: 60,
  annotations: 200,
  underlays: 1,
  semanticObjectsApprox: 1000,
});

const WALL_TYPES = 2;
const WALLS_PER_LEVEL = CORE_WORKFLOW_SCALE.walls / CORE_WORKFLOW_SCALE.levels;
const DOORS = CORE_WORKFLOW_SCALE.doorsAndWindows / 2;
const WINDOWS = CORE_WORKFLOW_SCALE.doorsAndWindows - DOORS;
const FILLER_DIMENSIONS =
  CORE_WORKFLOW_SCALE.semanticObjectsApprox -
  (CORE_WORKFLOW_SCALE.levels +
    WALL_TYPES +
    CORE_WORKFLOW_SCALE.walls +
    CORE_WORKFLOW_SCALE.rooms +
    CORE_WORKFLOW_SCALE.doorsAndWindows +
    DOORS +
    WINDOWS +
    CORE_WORKFLOW_SCALE.annotations +
    CORE_WORKFLOW_SCALE.underlays);

if (FILLER_DIMENSIONS < 0) {
  throw new Error('Core workflow semantic object target is below the protected fixture counts.');
}

function levelId(index: number): string {
  return `level-${index + 1}`;
}

function wallId(index: number): string {
  return `wall-${String(index + 1).padStart(3, '0')}`;
}

function openingId(index: number): string {
  return `opening-${String(index + 1).padStart(3, '0')}`;
}

function levelIndexForWall(index: number): number {
  return Math.floor(index / WALLS_PER_LEVEL);
}

/**
 * Builds only synthetic, repository-owned data. The geometry is intentionally regular:
 * scale changes are reviewable and deterministic, while the product still receives a
 * valid multi-level reference model through its real project-loading boundary.
 */
export function buildCoreWorkflowModel(): Record<string, unknown> {
  const levels = Array.from({ length: CORE_WORKFLOW_SCALE.levels }, (_, index) => ({
    id: levelId(index),
    name: `Synthetic level ${index + 1}`,
    elevation: index * 3200,
    storeyHeight: 3200,
  }));

  const wallTypes = [
    {
      id: 'wall-type-exterior',
      name: 'Synthetic exterior 250 mm',
      thickness: { value: 250, unit: 'mm' },
      defaultHeight: { value: 3000, unit: 'mm' },
      function: 'exterior',
    },
    {
      id: 'wall-type-interior',
      name: 'Synthetic interior 150 mm',
      thickness: { value: 150, unit: 'mm' },
      defaultHeight: { value: 3000, unit: 'mm' },
      function: 'interior',
    },
  ];

  const openings = Array.from({ length: CORE_WORKFLOW_SCALE.doorsAndWindows }, (_, index) => {
    const isDoor = index < DOORS;
    return {
      id: openingId(index),
      hostWallId: wallId(index),
      kind: isDoor ? 'door' : 'window',
      offsetFromWallStart: { value: 1000, unit: 'mm' },
      width: { value: isDoor ? 900 : 1200, unit: 'mm' },
      sillHeight: { value: isDoor ? 0 : 900, unit: 'mm' },
      height: { value: isDoor ? 2100 : 1200, unit: 'mm' },
    };
  });

  const walls = Array.from({ length: CORE_WORKFLOW_SCALE.walls }, (_, index) => {
    const levelIndex = levelIndexForWall(index);
    const localIndex = index % WALLS_PER_LEVEL;
    const column = localIndex % 15;
    const row = Math.floor(localIndex / 15);
    return {
      id: wallId(index),
      typeId: index % 3 === 0 ? 'wall-type-exterior' : 'wall-type-interior',
      levelId: levelId(levelIndex),
      start: { x: column * 6000, y: row * 6000 },
      end: { x: column * 6000 + 5000, y: row * 6000 },
      alignment: 'centre',
      joinStart: 'auto',
      joinEnd: 'auto',
      hostedOpeningIds:
        index < CORE_WORKFLOW_SCALE.doorsAndWindows ? [openingId(index)] : [],
    };
  });

  const doors = Array.from({ length: DOORS }, (_, index) => ({
    id: `door-${String(index + 1).padStart(3, '0')}`,
    typeId: 'door-type-synthetic',
    openingId: openingId(index),
    levelId: levelId(levelIndexForWall(index)),
    side: index % 2 === 0 ? 'left' : 'right',
    hand: index % 2 === 0 ? 'left' : 'right',
    swingAngle: 90,
  }));

  const windows = Array.from({ length: WINDOWS }, (_, offset) => {
    const index = DOORS + offset;
    return {
      id: `window-${String(offset + 1).padStart(3, '0')}`,
      typeId: 'window-type-synthetic',
      openingId: openingId(index),
      levelId: levelId(levelIndexForWall(index)),
      side: offset % 2 === 0 ? 'left' : 'right',
    };
  });

  const rooms = Array.from({ length: CORE_WORKFLOW_SCALE.rooms }, (_, index) => {
    const levelIndex = index < CORE_WORKFLOW_SCALE.rooms / 2 ? 0 : 1;
    const localIndex = index % (CORE_WORKFLOW_SCALE.rooms / 2);
    const hostWallIndex = levelIndex * WALLS_PER_LEVEL + localIndex * 2;
    const x = (localIndex % 10) * 6000 + 500;
    const y = Math.floor(localIndex / 10) * 6000 + 500;
    return {
      id: `room-${String(index + 1).padStart(3, '0')}`,
      levelId: levelId(levelIndex),
      seedPoint: { x: x + 1000, y: y + 1000 },
      name: `Synthetic room ${index + 1}`,
      number: String(index + 1).padStart(3, '0'),
      boundaryElementIds: [wallId(hostWallIndex)],
      calculatedBoundary: [
        { x, y },
        { x: x + 2000, y },
        { x: x + 2000, y: y + 2000 },
        { x, y: y + 2000 },
      ],
      calculatedArea: 4,
      status: 'valid',
    };
  });

  const annotations = Array.from({ length: CORE_WORKFLOW_SCALE.annotations }, (_, index) => ({
    id: `annotation-${String(index + 1).padStart(3, '0')}`,
    levelId: levelId(index % CORE_WORKFLOW_SCALE.levels),
    kind: 'synthetic-note',
    position: { x: (index % 20) * 1000, y: Math.floor(index / 20) * 1000 },
  }));

  const underlays = [
    {
      id: 'underlay-001',
      levelId: levelId(0),
      resourceId: 'synthetic-underlay-resource-001',
      kind: 'synthetic-reference-underlay',
    },
  ];

  // The current product reader reports linear dimensions as unsupported instead of
  // silently discarding them. They deliberately carry the remaining semantic-load
  // volume so the fixture reaches ~1,000 objects without inventing hundreds of wall
  // types or weakening the exact protected wall/room/opening/annotation counts.
  const linearDimensions = Array.from({ length: FILLER_DIMENSIONS }, (_, index) => ({
    id: `dimension-${String(index + 1).padStart(3, '0')}`,
  }));

  return {
    modelSchema: 'arq-bim-core-reference-v0+core-workflow-v1',
    sourceRepositoryRevision: 'synthetic-core-workflow-v1',
    project: {
      schemaVersion: 0,
      id: CORE_WORKFLOW_PROJECT_ID,
      name: CORE_WORKFLOW_PROJECT_NAME,
      units: 'metric',
      revision: CORE_WORKFLOW_REVISION,
      archived: false,
      levelIds: levels.map((level) => level.id),
    },
    levels,
    wallTypes,
    walls,
    rooms,
    openings,
    doors,
    windows,
    annotations,
    underlays,
    linearDimensions,
  };
}

export function countCoreWorkflowSemanticObjects(model: Record<string, unknown>): number {
  const arrays = [
    'levels',
    'wallTypes',
    'walls',
    'rooms',
    'openings',
    'doors',
    'windows',
    'annotations',
    'underlays',
    'linearDimensions',
  ];
  return arrays.reduce((total, key) => {
    const value = model[key];
    return total + (Array.isArray(value) ? value.length : 0);
  }, 0);
}

/** Creates a real SQLite `.arq` file through the repository's canonical ARQFS/archive writers. */
export async function writeCoreWorkflowArqFile(filename: string): Promise<void> {
  const entries = await exportArchive({
    manifest: createManifest({
      projectId: CORE_WORKFLOW_PROJECT_ID,
      applicationVersion: 'core-workflow-fixture-v1',
      schemaVersion: 0,
      createdAt: CORE_WORKFLOW_CREATED_AT,
    }),
    model: buildCoreWorkflowModel(),
  });

  const driver = createNodeArqfsDriver(filename);
  try {
    createArqfsSchemaV1(driver);
    putArchiveEntries(driver, entries);
  } finally {
    driver.close();
  }
}
