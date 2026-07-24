import { describe, expect, it } from 'vitest';
import { MemoryDerivedCacheStore, type DerivedCacheRecord } from './store';
import type { DerivedOutputMeta } from './types';

function record(key: string, value: string): DerivedCacheRecord<string> {
  const meta: DerivedOutputMeta = {
    projectId: 'p',
    projectRevision: 1,
    semanticHash: 'h',
    outputRevision: 1,
    engineFingerprint: 'e',
    generatedAt: '2026-01-01T00:00:00.000Z',
    sourceElementIds: [],
    stale: false,
    computationTimeMs: 1,
    cacheHit: false,
    approximationLevel: 'cached-vector',
  };
  return { key, meta, value };
}

describe('MemoryDerivedCacheStore', () => {
  it('returns null for a key that was never stored', async () => {
    const store = new MemoryDerivedCacheStore();
    expect(await store.get('missing')).toBeNull();
  });

  it('round-trips a stored record', async () => {
    const store = new MemoryDerivedCacheStore();
    await store.put(record('k1', 'v1'));
    expect(await store.get<string>('k1')).toEqual(record('k1', 'v1'));
  });

  it('deletes a single key without affecting others', async () => {
    const store = new MemoryDerivedCacheStore();
    await store.put(record('k1', 'v1'));
    await store.put(record('k2', 'v2'));

    await store.delete('k1');

    expect(await store.get('k1')).toBeNull();
    expect(await store.get('k2')).not.toBeNull();
  });

  it('clearNamespace removes every record', async () => {
    const store = new MemoryDerivedCacheStore();
    await store.put(record('k1', 'v1'));
    await store.put(record('k2', 'v2'));

    await store.clearNamespace();

    expect(await store.get('k1')).toBeNull();
    expect(await store.get('k2')).toBeNull();
  });
});
