import { describe, expect, it } from 'vitest';
import { computeEngineFingerprint } from './engine-fingerprint';
import type { EngineFingerprintInput } from './engine-fingerprint';

const BASE: EngineFingerprintInput = {
  operationSchema: 'v1',
  geometryAlgorithms: { wallJoin: 'butt-v1' },
  projectionAlgorithms: { plan: 'ortho-v1' },
  tolerancePolicy: 'tol-v1',
  styleSchema: 'style-v1',
  cacheRecordSchema: 'cache-v1',
};

describe('computeEngineFingerprint', () => {
  it('is deterministic for the same input', async () => {
    expect(await computeEngineFingerprint(BASE)).toBe(await computeEngineFingerprint({ ...BASE }));
  });

  it('changes when a geometry algorithm version changes', async () => {
    const changed = { ...BASE, geometryAlgorithms: { wallJoin: 'butt-v2' } };
    expect(await computeEngineFingerprint(BASE)).not.toBe(await computeEngineFingerprint(changed));
  });

  it('is independent of top-level key order', async () => {
    const reordered: EngineFingerprintInput = {
      cacheRecordSchema: BASE.cacheRecordSchema,
      styleSchema: BASE.styleSchema,
      tolerancePolicy: BASE.tolerancePolicy,
      projectionAlgorithms: BASE.projectionAlgorithms,
      geometryAlgorithms: BASE.geometryAlgorithms,
      operationSchema: BASE.operationSchema,
    };
    expect(await computeEngineFingerprint(BASE)).toBe(await computeEngineFingerprint(reordered));
  });

  it('produces a different fingerprint when an optional capabilityVersion is added', async () => {
    expect(await computeEngineFingerprint(BASE)).not.toBe(
      await computeEngineFingerprint({ ...BASE, capabilityVersion: 'cap-v1' }),
    );
  });
});
