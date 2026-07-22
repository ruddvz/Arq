import { describe, expect, it } from 'vitest';
import {
  CURRENT_SCHEMA_VERSION,
  createManifest,
  parseManifest,
  serializeManifest,
} from './manifest';

describe('createManifest', () => {
  it('defaults schemaVersion to CURRENT_SCHEMA_VERSION and createdAt to now', () => {
    const manifest = createManifest({ projectId: 'p1', applicationVersion: '1.0.0' });
    expect(manifest.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    expect(manifest.projectId).toBe('p1');
    expect(typeof manifest.createdAt).toBe('string');
  });

  it('accepts an explicit schemaVersion and createdAt', () => {
    const manifest = createManifest({
      projectId: 'p1',
      applicationVersion: '1.0.0',
      schemaVersion: 3,
      createdAt: '2026-01-01T00:00:00.000Z',
    });
    expect(manifest.schemaVersion).toBe(3);
    expect(manifest.createdAt).toBe('2026-01-01T00:00:00.000Z');
  });
});

describe('serializeManifest / parseManifest round trip', () => {
  it('parses back exactly what was serialized', () => {
    const manifest = createManifest({
      projectId: 'p1',
      applicationVersion: '1.0.0',
      createdAt: '2026-01-01T00:00:00.000Z',
    });
    const parsed = parseManifest(serializeManifest(manifest));
    expect(parsed).toEqual(manifest);
  });
});

describe('parseManifest failure modes (corrupt manifest fails safely)', () => {
  it('returns null for invalid JSON rather than throwing', () => {
    expect(parseManifest('{not valid json')).toBeNull();
  });

  it('returns null when a required field is missing', () => {
    expect(
      parseManifest(JSON.stringify({ schemaVersion: 0, applicationVersion: '1.0.0' })),
    ).toBeNull();
  });

  it('returns null when a field has the wrong type', () => {
    expect(
      parseManifest(
        JSON.stringify({
          schemaVersion: '0',
          applicationVersion: '1.0.0',
          projectId: 'p1',
          createdAt: '2026-01-01T00:00:00.000Z',
        }),
      ),
    ).toBeNull();
  });

  it('returns null for a JSON value that is not an object', () => {
    expect(parseManifest('"just a string"')).toBeNull();
    expect(parseManifest('42')).toBeNull();
    expect(parseManifest('null')).toBeNull();
  });
});
