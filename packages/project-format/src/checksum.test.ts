import { describe, expect, it } from 'vitest';
import { computeChecksums, parseChecksums, serializeChecksums, verifyChecksums } from './checksum';

const encoder = new TextEncoder();

describe('computeChecksums', () => {
  it('computes a sha256 hex digest per entry, sorted by path', async () => {
    const entries = new Map([
      ['b.json', encoder.encode('b')],
      ['a.json', encoder.encode('a')],
    ]);
    const checksums = await computeChecksums(entries);
    expect(checksums.map((c) => c.path)).toEqual(['a.json', 'b.json']);
    expect(checksums[0]?.sha256).toMatch(/^[0-9a-f]{64}$/);
  });

  it('produces the same digest for the same content, deterministically', async () => {
    const entries = new Map([['x', encoder.encode('same content')]]);
    const first = await computeChecksums(entries);
    const second = await computeChecksums(entries);
    expect(first).toEqual(second);
  });

  it('produces different digests for different content', async () => {
    const a = await computeChecksums(new Map([['x', encoder.encode('one')]]));
    const b = await computeChecksums(new Map([['x', encoder.encode('two')]]));
    expect(a[0]?.sha256).not.toBe(b[0]?.sha256);
  });
});

describe('verifyChecksums', () => {
  it('returns an empty array when everything matches', async () => {
    const entries = new Map([['model.json', encoder.encode('{}')]]);
    const checksums = await computeChecksums(entries);
    expect(await verifyChecksums(entries, checksums)).toEqual([]);
  });

  it('flags a path whose content has changed since the checksum was recorded', async () => {
    const entries = new Map([['model.json', encoder.encode('{}')]]);
    const checksums = await computeChecksums(entries);
    const tampered = new Map([['model.json', encoder.encode('{"tampered": true}')]]);
    expect(await verifyChecksums(tampered, checksums)).toEqual(['model.json']);
  });

  it('flags a path listed in the checksums but missing from the entries', async () => {
    const checksums = await computeChecksums(new Map([['missing.json', encoder.encode('x')]]));
    expect(await verifyChecksums(new Map(), checksums)).toEqual(['missing.json']);
  });
});

describe('serializeChecksums / parseChecksums round trip and corruption handling', () => {
  it('parses back exactly what was serialized', async () => {
    const checksums = await computeChecksums(new Map([['a', encoder.encode('a')]]));
    expect(parseChecksums(serializeChecksums(checksums))).toEqual(checksums);
  });

  it('returns an empty array (never throws) for invalid JSON - corrupt optional data fails safely', () => {
    expect(parseChecksums('{not valid')).toEqual([]);
  });

  it('returns an empty array for a JSON value that is not an array', () => {
    expect(parseChecksums('{"path": "x"}')).toEqual([]);
  });

  it('filters out malformed entries within an otherwise-valid array', () => {
    expect(
      parseChecksums(JSON.stringify([{ path: 'ok', sha256: 'abc' }, { path: 'bad' }, 'garbage'])),
    ).toEqual([{ path: 'ok', sha256: 'abc' }]);
  });
});
