import { describe, expect, it } from 'vitest';
import { canonicalJson, sha256Hex } from './canonical';

describe('canonicalJson', () => {
  it('is independent of key order', () => {
    expect(canonicalJson({ b: 1, a: 2 })).toBe(canonicalJson({ a: 2, b: 1 }));
  });

  it('sorts keys at every nesting depth', () => {
    expect(canonicalJson({ z: { d: 1, c: 2 }, a: 1 })).toBe(
      canonicalJson({ a: 1, z: { c: 2, d: 1 } }),
    );
  });

  it('omits undefined values rather than serialising them as null', () => {
    expect(canonicalJson({ a: 1, b: undefined })).toBe(canonicalJson({ a: 1 }));
  });

  it('preserves array order (arrays are not sorted, only object keys)', () => {
    expect(canonicalJson({ list: [2, 1] })).not.toBe(canonicalJson({ list: [1, 2] }));
  });

  it('produces different output for genuinely different values', () => {
    expect(canonicalJson({ a: 1 })).not.toBe(canonicalJson({ a: 2 }));
  });
});

describe('sha256Hex', () => {
  it('hashes empty input to the well-known SHA-256 of the empty string', async () => {
    expect(await sha256Hex('')).toBe(
      'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    );
  });

  it('is deterministic for the same input', async () => {
    expect(await sha256Hex('arq')).toBe(await sha256Hex('arq'));
  });

  it('differs for different input', async () => {
    expect(await sha256Hex('arq')).not.toBe(await sha256Hex('arq2'));
  });
});
