import { describe, expect, it } from 'vitest';
import { correlationIdOf, parseArqfsWorkerRequest } from './arqfs-worker-protocol';

/**
 * V3-021. `ArqfsWorkerRequest` is a claim about what a caller sends; these
 * exercise what a Worker boundary can actually be handed.
 */

describe('parseArqfsWorkerRequest', () => {
  it.each([
    ['a non-object', 42],
    ['null', null],
    ['a missing id', { type: 'open' }],
    ['a non-numeric id', { id: 'one', type: 'open' }],
    // NaN correlates against nothing: NaN !== NaN, so a response keyed on it
    // could never be matched to its pending request.
    ['a NaN id', { id: Number.NaN, type: 'open' }],
    ['an unrecognised type', { id: 1, type: 'exec' }],
    ['a missing type', { id: 1 }],
    ['importDatabase without bytes', { id: 1, type: 'importDatabase' }],
    [
      'importDatabase with an ArrayBuffer instead of a view',
      { id: 1, type: 'importDatabase', bytes: new ArrayBuffer(4) },
    ],
    ['getArchiveEntry without a path', { id: 1, type: 'getArchiveEntry' }],
    ['publish without a target name', { id: 1, type: 'publish' }],
    ['publish with an empty target name', { id: 1, type: 'publish', targetName: '' }],
    [
      'publish with a fractional revision',
      { id: 1, type: 'publish', targetName: 'out.arq', expectedRevision: 1.5 },
    ],
    [
      'publish with a non-numeric revision',
      { id: 1, type: 'publish', targetName: 'out.arq', expectedRevision: 'latest' },
    ],
    ['getArchiveEntry with a non-string path', { id: 1, type: 'getArchiveEntry', path: 7 }],
    ['putArchiveEntries with a non-array', { id: 1, type: 'putArchiveEntries', entries: 'nope' }],
    [
      'putArchiveEntries with a malformed pair',
      { id: 1, type: 'putArchiveEntries', entries: [['a.json']] },
    ],
    [
      'putArchiveEntries whose content is not bytes',
      { id: 1, type: 'putArchiveEntries', entries: [['a.json', 'text']] },
    ],
  ])('rejects %s', (_label, value) => {
    expect(parseArqfsWorkerRequest(value)).toBeNull();
  });

  it.each([
    ['open', { id: 1, type: 'open' }],
    ['migrateSchemaV1ToV2', { id: 9, type: 'migrateSchemaV1ToV2' }],
    ['listArchiveEntryPaths', { id: 2, type: 'listArchiveEntryPaths' }],
    ['readAllArchiveEntries', { id: 3, type: 'readAllArchiveEntries' }],
    ['close', { id: 4, type: 'close' }],
    ['publish', { id: 7, type: 'publish', targetName: 'out.arq' }],
    [
      'publish with an expected revision',
      { id: 8, type: 'publish', targetName: 'out.arq', expectedRevision: 12 },
    ],
  ])('accepts a well-formed %s', (_label, value) => {
    expect(parseArqfsWorkerRequest(value)).toEqual(value);
  });

  it('accepts a well-formed putArchiveEntries and keeps its pairs', () => {
    const content = new Uint8Array([1, 2, 3]);
    expect(
      parseArqfsWorkerRequest({
        id: 5,
        type: 'putArchiveEntries',
        entries: [['manifest.json', content]],
      }),
    ).toEqual({ id: 5, type: 'putArchiveEntries', entries: [['manifest.json', content]] });
  });

  it('returns only the fields the variant declares, so unexpected extras cannot ride along', () => {
    const parsed = parseArqfsWorkerRequest({ id: 6, type: 'open', path: '../../etc/passwd' });

    expect(parsed).toEqual({ id: 6, type: 'open' });
    expect(parsed !== null && 'path' in parsed).toBe(false);
  });

  it('accepts id 0, which is falsy but a perfectly good correlation id', () => {
    expect(parseArqfsWorkerRequest({ id: 0, type: 'close' })).toEqual({ id: 0, type: 'close' });
  });

  it('keeps expectedRevision absent rather than present-and-undefined', () => {
    const parsed = parseArqfsWorkerRequest({ id: 1, type: 'publish', targetName: 'out.arq' });

    expect(parsed).not.toBeNull();
    // Publishing "whatever is current" and publishing a revision that happens to
    // be undefined are different requests, and only one of them survives
    // structuredClone under exactOptionalPropertyTypes.
    expect(parsed !== null && 'expectedRevision' in parsed).toBe(false);
  });
});

describe('correlationIdOf', () => {
  it('recovers the id from an otherwise unparseable request', () => {
    // The common malformed request is a newer caller sending a type this build
    // does not know - it still carries a usable id, and answering under it turns
    // a timeout into an immediate refusal.
    expect(correlationIdOf({ id: 9, type: 'somethingNewer' })).toBe(9);
  });

  it('reports no id when there is none, rather than inventing one', () => {
    expect(correlationIdOf({ type: 'open' })).toBeNull();
    expect(correlationIdOf(null)).toBeNull();
    expect(correlationIdOf('a string')).toBeNull();
    expect(correlationIdOf({ id: Number.NaN })).toBeNull();
  });
});
