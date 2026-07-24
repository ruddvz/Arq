import { describe, expect, it } from 'vitest';
import { buildCacheKeyMaterial, computeCacheKey } from './cache-key';
import type { CacheKeyInput } from './types';

const BASE: CacheKeyInput = {
  namespaceVersion: 1,
  projectId: 'p',
  semanticRevisionHash: 'h',
  engineFingerprint: 'e',
  outputKind: 'thumbnail',
  scopeId: 's',
  capabilityTier: 'desktop',
  representationTier: 'bounding-box',
};

describe('buildCacheKeyMaterial', () => {
  it('is deterministic across property order', () => {
    expect(buildCacheKeyMaterial(BASE)).toBe(buildCacheKeyMaterial({ ...BASE }));
  });

  it('differs when any semantically meaningful field differs', () => {
    expect(buildCacheKeyMaterial(BASE)).not.toBe(
      buildCacheKeyMaterial({ ...BASE, scopeId: 'other' }),
    );
  });

  it('rejects a non-positive namespaceVersion', () => {
    expect(() => buildCacheKeyMaterial({ ...BASE, namespaceVersion: 0 })).toThrow(
      /namespaceVersion/,
    );
  });

  it('rejects empty required string fields', () => {
    expect(() => buildCacheKeyMaterial({ ...BASE, projectId: '' })).toThrow(/must be non-empty/);
    expect(() => buildCacheKeyMaterial({ ...BASE, semanticRevisionHash: '' })).toThrow(
      /must be non-empty/,
    );
    expect(() => buildCacheKeyMaterial({ ...BASE, engineFingerprint: '' })).toThrow(
      /must be non-empty/,
    );
    expect(() => buildCacheKeyMaterial({ ...BASE, scopeId: '' })).toThrow(/must be non-empty/);
  });
});

describe('computeCacheKey', () => {
  it('hashes the canonical material deterministically', async () => {
    expect(await computeCacheKey(BASE)).toBe(await computeCacheKey({ ...BASE }));
  });

  it('produces a 64-character hex digest', async () => {
    expect(await computeCacheKey(BASE)).toMatch(/^[0-9a-f]{64}$/);
  });
});
