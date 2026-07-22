import { describe, expect, it } from 'vitest';
import { createManifest } from './manifest';
import { exportArchive, importArchive, MAX_ENTRY_BYTES } from './archive';

const baseManifestInput = {
  projectId: 'p1',
  applicationVersion: '1.0.0',
  createdAt: '2026-01-01T00:00:00.000Z',
};

describe('exportArchive / importArchive round trip', () => {
  it('opens successfully with all fields intact, no ignored or corrupt paths', async () => {
    const manifest = createManifest(baseManifestInput);
    const entries = await exportArchive({
      manifest,
      model: { levels: [] },
      operations: [{ type: 'CreateElement' }],
      views: { defaultView: 'plan' },
      sheets: { list: [] },
    });
    const result = await importArchive(entries);
    expect(result.status).toBe('opened');
    if (result.status === 'opened') {
      expect(result.manifest).toEqual(manifest);
      expect(result.model).toEqual({ levels: [] });
      expect(result.operations).toEqual([{ type: 'CreateElement' }]);
      expect(result.views).toEqual({ defaultView: 'plan' });
      expect(result.sheets).toEqual({ list: [] });
      expect(result.ignoredPaths).toEqual([]);
      expect(result.corruptOptionalPaths).toEqual([]);
    }
  });

  it('opens successfully with only the required files present', async () => {
    const manifest = createManifest(baseManifestInput);
    const entries = await exportArchive({ manifest, model: {} });
    const result = await importArchive(entries);
    expect(result.status).toBe('opened');
    if (result.status === 'opened') {
      expect(result.operations).toEqual([]);
      expect(result.views).toBeUndefined();
    }
  });
});

describe('importArchive rejects a missing or corrupt required file', () => {
  it('rejects when manifest.json is missing', async () => {
    const entries = new Map([['model.json', new TextEncoder().encode('{}')]]);
    const result = await importArchive(entries);
    expect(result.status).toBe('rejected');
  });

  it('rejects when manifest.json is corrupt', async () => {
    const entries = new Map([
      ['manifest.json', new TextEncoder().encode('not valid json')],
      ['model.json', new TextEncoder().encode('{}')],
    ]);
    const result = await importArchive(entries);
    expect(result.status).toBe('rejected');
  });

  it('rejects when model.json is missing', async () => {
    const manifest = createManifest(baseManifestInput);
    const entries = new Map([
      ['manifest.json', new TextEncoder().encode(JSON.stringify(manifest))],
    ]);
    const result = await importArchive(entries);
    expect(result.status).toBe('rejected');
  });

  it('rejects when model.json is corrupt', async () => {
    const manifest = createManifest(baseManifestInput);
    const entries = new Map([
      ['manifest.json', new TextEncoder().encode(JSON.stringify(manifest))],
      ['model.json', new TextEncoder().encode('{not valid')],
    ]);
    const result = await importArchive(entries);
    expect(result.status).toBe('rejected');
  });
});

describe('importArchive tolerates corrupt or unknown optional data (fails safely, not fatally)', () => {
  it('reports operations.ndjson as corrupt but still opens the archive', async () => {
    const manifest = createManifest(baseManifestInput);
    const entries = new Map([
      ['manifest.json', new TextEncoder().encode(JSON.stringify(manifest))],
      ['model.json', new TextEncoder().encode('{}')],
      ['operations.ndjson', new TextEncoder().encode('{not valid ndjson')],
    ]);
    const result = await importArchive(entries);
    expect(result.status).toBe('opened');
    if (result.status === 'opened') {
      expect(result.corruptOptionalPaths).toEqual(['operations.ndjson']);
      expect(result.operations).toEqual([]);
    }
  });

  it('reports an unrecognized top-level entry as ignored, not rejected', async () => {
    const manifest = createManifest(baseManifestInput);
    const entries = new Map([
      ['manifest.json', new TextEncoder().encode(JSON.stringify(manifest))],
      ['model.json', new TextEncoder().encode('{}')],
      ['future-feature.json', new TextEncoder().encode('{}')],
    ]);
    const result = await importArchive(entries);
    expect(result.status).toBe('opened');
    if (result.status === 'opened') {
      expect(result.ignoredPaths).toEqual(['future-feature.json']);
    }
  });

  it('does not reject on a corrupt entry inside a known optional directory (thumbnails/)', async () => {
    const manifest = createManifest(baseManifestInput);
    const entries = new Map([
      ['manifest.json', new TextEncoder().encode(JSON.stringify(manifest))],
      ['model.json', new TextEncoder().encode('{}')],
      ['thumbnails/level-1.png', new Uint8Array([0xff, 0xd8, 0xff])],
    ]);
    const result = await importArchive(entries);
    expect(result.status).toBe('opened');
    if (result.status === 'opened') {
      expect(result.ignoredPaths).toEqual([]);
    }
  });
});

describe('importArchive rejects unsafe archive contents', () => {
  it('rejects a path-traversal entry', async () => {
    const manifest = createManifest(baseManifestInput);
    const entries = new Map([
      ['manifest.json', new TextEncoder().encode(JSON.stringify(manifest))],
      ['model.json', new TextEncoder().encode('{}')],
      ['../../etc/passwd', new TextEncoder().encode('x')],
    ]);
    const result = await importArchive(entries);
    expect(result.status).toBe('rejected');
  });

  it('rejects an absolute path entry', async () => {
    const manifest = createManifest(baseManifestInput);
    const entries = new Map([
      ['manifest.json', new TextEncoder().encode(JSON.stringify(manifest))],
      ['model.json', new TextEncoder().encode('{}')],
      ['/etc/passwd', new TextEncoder().encode('x')],
    ]);
    const result = await importArchive(entries);
    expect(result.status).toBe('rejected');
  });

  it('rejects an entry exceeding the per-entry size cap', async () => {
    const manifest = createManifest(baseManifestInput);
    const entries = new Map([
      ['manifest.json', new TextEncoder().encode(JSON.stringify(manifest))],
      ['model.json', new Uint8Array(MAX_ENTRY_BYTES + 1)],
    ]);
    const result = await importArchive(entries);
    expect(result.status).toBe('rejected');
  });
});
