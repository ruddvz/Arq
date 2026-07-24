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

  it('FP-036: a fully cleared cache is behaviourally indistinguishable from a brand-new one - the concrete evidence backing the README\'s "canonical project data never depends on this package" / safe-to-delete claim', async () => {
    const fresh = new MemoryDerivedCacheStore();
    const populated = new MemoryDerivedCacheStore();
    const keys = ['k1', 'k2', 'k3', 'k4', 'k5'];
    for (const key of keys) {
      await populated.put(record(key, `v-${key}`));
    }

    await populated.clearNamespace();

    for (const key of keys) {
      expect(await populated.get(key)).toEqual(await fresh.get(key));
    }

    // Clearing an already-empty namespace must not throw - deletion is total,
    // not merely "removes whatever happens to still be there".
    await expect(populated.clearNamespace()).resolves.toBeUndefined();

    // No residual state (e.g. a lingering namespace marker) blocks or alters
    // future writes - the cleared store accepts a new put exactly like a fresh one.
    await populated.put(record('k1', 'after-clear'));
    await fresh.put(record('k1', 'after-clear'));
    expect(await populated.get('k1')).toEqual(await fresh.get('k1'));
  });
});
