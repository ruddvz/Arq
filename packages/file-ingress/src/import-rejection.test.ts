import { describe, expect, it } from 'vitest';
import {
  IMPORT_REJECTION_CODES,
  ImportRejection,
  importRejectionCode,
  isSourceIntegrityRejection,
} from './import-rejection';
import { DEFAULT_IMPORT_POLICY } from './policy';
import { executeAdapter, prepareImport } from './orchestrator';
import type { ImportAdapter } from './types';

const SOURCE = { name: 'plan.dxf', byteLength: 4 };
const BYTES = new Uint8Array([1, 2, 3, 4]);

const ADAPTER: ImportAdapter = {
  id: 'test',
  version: '1',
  formatIds: ['dxf'],
  maximumFidelity: 'structured',
  convert: async () => ({
    stagedElements: [],
    resources: [],
    mappings: [],
    report: {
      formatId: 'dxf',
      adapterId: 'test',
      adapterVersion: '1',
      fidelity: 'structured',
      sourceSha256: 'a',
      sourceByteLength: 4,
      preservedCount: 0,
      convertedCount: 0,
      approximatedCount: 0,
      ignoredCount: 0,
      issues: [],
      timingsMs: {},
    },
  }),
};

function run(overrides: Partial<Parameters<typeof executeAdapter>[0]> = {}) {
  return executeAdapter({
    adapter: ADAPTER,
    bytes: BYTES,
    source: SOURCE,
    sourceSha256: 'a',
    policy: DEFAULT_IMPORT_POLICY,
    signal: new AbortController().signal,
    ...overrides,
  });
}

describe('importRejectionCode', () => {
  it('reads the code off a classified rejection', () => {
    const error = new ImportRejection(IMPORT_REJECTION_CODES.sourceTooLarge, 'too big');

    expect(importRejectionCode(error, 'FALLBACK')).toBe(IMPORT_REJECTION_CODES.sourceTooLarge);
  });

  it('leaves an unclassified error on the generic code', () => {
    // An error nobody classified is one nobody has decided how to handle, and
    // giving it a specific code would claim otherwise.
    expect(importRejectionCode(new Error('who knows'), 'FALLBACK')).toBe('FALLBACK');
    expect(importRejectionCode('a string', 'FALLBACK')).toBe('FALLBACK');
  });
});

describe('isSourceIntegrityRejection', () => {
  it('separates the source changing from every other refusal', () => {
    // Retrying reads whatever the bytes are now, which is the situation that
    // produced the mismatch.
    expect(isSourceIntegrityRejection(IMPORT_REJECTION_CODES.sourceDigestChanged)).toBe(true);
    expect(isSourceIntegrityRejection(IMPORT_REJECTION_CODES.sourceLengthChanged)).toBe(true);
    expect(isSourceIntegrityRejection(IMPORT_REJECTION_CODES.adapterUnavailable)).toBe(false);
    expect(isSourceIntegrityRejection(IMPORT_REJECTION_CODES.sourceTooLarge)).toBe(false);
  });
});

describe('executeAdapter rejections carry their reason', () => {
  it('distinguishes a length mismatch from a policy breach', async () => {
    // Both used to arrive as IMPORT_WORKER_FAILED with only prose to tell them
    // apart, and prose is what changes when somebody improves the wording.
    await expect(run({ source: { name: 'plan.dxf', byteLength: 5 } })).rejects.toMatchObject({
      code: IMPORT_REJECTION_CODES.sourceLengthChanged,
    });

    await expect(
      run({ policy: { ...DEFAULT_IMPORT_POLICY, maxSourceBytes: 1 } }),
    ).rejects.toMatchObject({ code: IMPORT_REJECTION_CODES.sourceTooLarge });
  });

  it('names an expired deadline', async () => {
    await expect(
      run({ policy: { ...DEFAULT_IMPORT_POLICY, deadlineUnixMs: 1 } }),
    ).rejects.toMatchObject({ code: IMPORT_REJECTION_CODES.deadlineExpired });
  });

  it('names an adapter that returned more than the policy allows', async () => {
    const flood: ImportAdapter = {
      ...ADAPTER,
      convert: async (context) => ({
        ...(await ADAPTER.convert(context)),
        stagedElements: [
          { id: 'a', kind: 'line', properties: {} },
          { id: 'b', kind: 'line', properties: {} },
        ],
      }),
    };

    await expect(
      run({ adapter: flood, policy: { ...DEFAULT_IMPORT_POLICY, maxStagedElements: 1 } }),
    ).rejects.toMatchObject({ code: IMPORT_REJECTION_CODES.tooManyStagedElements });
  });

  it('carries a code through prepareImport as well', async () => {
    await expect(
      prepareImport(BYTES, { name: 'plan.dxf', byteLength: 9 }, DEFAULT_IMPORT_POLICY),
    ).rejects.toMatchObject({ code: IMPORT_REJECTION_CODES.sourceLengthChanged });
  });

  it('lets a sound import through', async () => {
    await expect(run()).resolves.toMatchObject({ stagedElements: [] });
  });
});
