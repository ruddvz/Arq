import { afterEach, describe, expect, it, vi } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import {
  createNodeArqfsDriver,
  openArqfs,
  readAllArchiveEntries,
} from '@arq/arqfs';
import { importArchive } from '@arq/project-format';
import { decodeNativeProjectModel } from '../../apps/web/src/project/native-project-model';
import {
  buildCoreWorkflowModel,
  CORE_WORKFLOW_PROJECT_NAME,
  CORE_WORKFLOW_REVISION,
  CORE_WORKFLOW_SCALE,
  countCoreWorkflowSemanticObjects,
  writeCoreWorkflowArqFile,
} from './core-workflow-product-fixture';

const temporaryDirectories: string[] = [];

afterEach(() => {
  vi.restoreAllMocks();
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

function arrayLength(model: Record<string, unknown>, key: string): number {
  const value = model[key];
  if (!Array.isArray(value)) throw new Error(`Core fixture ${key} is not an array.`);
  return value.length;
}

function newFixturePath(): string {
  const directory = mkdtempSync(path.join(tmpdir(), 'arq-core-workflow-'));
  temporaryDirectories.push(directory);
  return path.join(directory, 'core-workflow-v1.arq');
}

describe('Core workflow product fixture', () => {
  it('mechanically protects every #402 Core scale dimension', () => {
    const model = buildCoreWorkflowModel();

    expect(arrayLength(model, 'levels')).toBe(CORE_WORKFLOW_SCALE.levels);
    expect(arrayLength(model, 'walls')).toBe(CORE_WORKFLOW_SCALE.walls);
    expect(arrayLength(model, 'openings')).toBe(CORE_WORKFLOW_SCALE.doorsAndWindows);
    expect(arrayLength(model, 'doors') + arrayLength(model, 'windows')).toBe(
      CORE_WORKFLOW_SCALE.doorsAndWindows,
    );
    expect(arrayLength(model, 'rooms')).toBe(CORE_WORKFLOW_SCALE.rooms);
    expect(arrayLength(model, 'annotations')).toBe(CORE_WORKFLOW_SCALE.annotations);
    expect(arrayLength(model, 'underlays')).toBe(CORE_WORKFLOW_SCALE.underlays);
    expect(countCoreWorkflowSemanticObjects(model)).toBe(CORE_WORKFLOW_SCALE.semanticObjectsApprox);
  });

  it('creates a real .arq file and traverses the canonical ARQFS, archive and web-app model decoder', async () => {
    // ARQFS stores update timestamps. Freezing the clock keeps the generated fixture
    // structurally deterministic without teaching production code about benchmarks.
    vi.spyOn(Date, 'now').mockReturnValue(Date.parse('2026-01-01T00:00:00.000Z'));
    const fixturePath = newFixturePath();
    await writeCoreWorkflowArqFile(fixturePath);

    const driver = createNodeArqfsDriver(fixturePath);
    try {
      const nativeOpen = openArqfs(driver);
      expect(nativeOpen.status).toBe('opened');
      if (nativeOpen.status !== 'opened') throw new Error(nativeOpen.reason);
      expect(nativeOpen.capabilities.canRead).toBe(true);

      const archive = await importArchive(readAllArchiveEntries(driver));
      expect(archive.status).toBe('opened');
      if (archive.status !== 'opened') throw new Error(archive.reason);

      const rawModel = archive.model as Record<string, unknown>;
      expect(arrayLength(rawModel, 'levels')).toBe(CORE_WORKFLOW_SCALE.levels);
      expect(arrayLength(rawModel, 'walls')).toBe(CORE_WORKFLOW_SCALE.walls);
      expect(arrayLength(rawModel, 'openings')).toBe(CORE_WORKFLOW_SCALE.doorsAndWindows);
      expect(arrayLength(rawModel, 'rooms')).toBe(CORE_WORKFLOW_SCALE.rooms);
      expect(arrayLength(rawModel, 'annotations')).toBe(CORE_WORKFLOW_SCALE.annotations);
      expect(arrayLength(rawModel, 'underlays')).toBe(CORE_WORKFLOW_SCALE.underlays);
      expect(countCoreWorkflowSemanticObjects(rawModel)).toBe(
        CORE_WORKFLOW_SCALE.semanticObjectsApprox,
      );

      const decoded = decodeNativeProjectModel(archive.model, archive.views);
      expect(decoded.status).toBe('decoded');
      if (decoded.status !== 'decoded') throw new Error(decoded.reason);
      expect(decoded.model.projectName).toBe(CORE_WORKFLOW_PROJECT_NAME);
      expect(decoded.model.document).not.toBeNull();
      const document = decoded.model.document;
      if (document === null) throw new Error('Core fixture decoded as a flat project.');

      expect(document.summary.revision).toBe(CORE_WORKFLOW_REVISION);
      expect(document.levels).toHaveLength(CORE_WORKFLOW_SCALE.levels);
      expect(document.walls).toHaveLength(CORE_WORKFLOW_SCALE.walls);
      expect(document.openings).toHaveLength(CORE_WORKFLOW_SCALE.doorsAndWindows);
      expect(document.doors.length + document.windows.length).toBe(
        CORE_WORKFLOW_SCALE.doorsAndWindows,
      );
      expect(document.rooms).toHaveLength(CORE_WORKFLOW_SCALE.rooms);
      expect(document.unsupported.map((entry) => `${entry.section}:${entry.count}`)).toContain(
        `linearDimensions:${
          CORE_WORKFLOW_SCALE.semanticObjectsApprox -
          (CORE_WORKFLOW_SCALE.levels +
            2 +
            CORE_WORKFLOW_SCALE.walls +
            CORE_WORKFLOW_SCALE.rooms +
            CORE_WORKFLOW_SCALE.doorsAndWindows * 2 +
            CORE_WORKFLOW_SCALE.annotations +
            CORE_WORKFLOW_SCALE.underlays)
        }`,
      );
    } finally {
      driver.close();
    }
  });
});
