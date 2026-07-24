import { describe, expect, it } from 'vitest';
import { executeAdapter, prepareImport, routeForCandidate } from './orchestrator';
import { UnderlayAdapter } from './underlay-adapter';
import { DEFAULT_IMPORT_POLICY } from './policy';
import type { ImportAdapter, ImportAdapterResult } from './types';

const PDF_BYTES = new TextEncoder().encode('%PDF-1.7\nrest');

describe('prepareImport', () => {
  it('hashes the bytes and returns ranked format candidates', async () => {
    const result = await prepareImport(
      PDF_BYTES,
      { name: 'x.pdf', byteLength: PDF_BYTES.byteLength },
      DEFAULT_IMPORT_POLICY,
    );
    expect(result.candidates[0]?.formatId).toBe('pdf');
    expect(result.sourceSha256).toMatch(/^[0-9a-f]{64}$/);
  });

  it('rejects when the descriptor byte length does not match the acquired bytes', async () => {
    await expect(
      prepareImport(
        PDF_BYTES,
        { name: 'x.pdf', byteLength: PDF_BYTES.byteLength + 1 },
        DEFAULT_IMPORT_POLICY,
      ),
    ).rejects.toThrow(/does not match/);
  });

  it('rejects a source larger than the policy allows', async () => {
    const policy = { ...DEFAULT_IMPORT_POLICY, maxSourceBytes: 1 };
    await expect(
      prepareImport(PDF_BYTES, { name: 'x.pdf', byteLength: PDF_BYTES.byteLength }, policy),
    ).rejects.toThrow(/exceeds import policy/);
  });
});

describe('routeForCandidate', () => {
  it('resolves a known format id to its definition', () => {
    expect(
      routeForCandidate({ formatId: 'pdf', confidence: 1, evidence: [], extensionMismatch: false })
        ?.route,
    ).toBe('underlay');
  });

  it('returns undefined for an unregistered format id', () => {
    expect(
      routeForCandidate({
        formatId: 'not-a-real-format',
        confidence: 1,
        evidence: [],
        extensionMismatch: false,
      }),
    ).toBeUndefined();
  });
});

describe('executeAdapter', () => {
  const source = { name: 'x.pdf', byteLength: PDF_BYTES.byteLength };

  it('runs the adapter and returns its result under a permissive policy', async () => {
    const result = await executeAdapter({
      adapter: new UnderlayAdapter(),
      bytes: PDF_BYTES,
      source,
      sourceSha256: 'abc',
      policy: DEFAULT_IMPORT_POLICY,
      signal: new AbortController().signal,
    });
    expect(result.report.fidelity).toBe('underlay');
  });

  it('rejects when the source byte length changed since acquisition', async () => {
    await expect(
      executeAdapter({
        adapter: new UnderlayAdapter(),
        bytes: PDF_BYTES,
        source: { ...source, byteLength: source.byteLength + 1 },
        sourceSha256: 'abc',
        policy: DEFAULT_IMPORT_POLICY,
        signal: new AbortController().signal,
      }),
    ).rejects.toThrow(/byte length changed/);
  });

  it('rejects when the source exceeds the configured policy size', async () => {
    await expect(
      executeAdapter({
        adapter: new UnderlayAdapter(),
        bytes: PDF_BYTES,
        source,
        sourceSha256: 'abc',
        policy: { ...DEFAULT_IMPORT_POLICY, maxSourceBytes: 1 },
        signal: new AbortController().signal,
      }),
    ).rejects.toThrow(/exceeds import policy/);
  });

  it('rejects when the signal is already aborted', async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(
      executeAdapter({
        adapter: new UnderlayAdapter(),
        bytes: PDF_BYTES,
        source,
        sourceSha256: 'abc',
        policy: DEFAULT_IMPORT_POLICY,
        signal: controller.signal,
      }),
    ).rejects.toThrow(/Cancelled/);
  });

  it('rejects when the deadline has already passed', async () => {
    await expect(
      executeAdapter({
        adapter: new UnderlayAdapter(),
        bytes: PDF_BYTES,
        source,
        sourceSha256: 'abc',
        policy: { ...DEFAULT_IMPORT_POLICY, deadlineUnixMs: Date.now() - 1 },
        signal: new AbortController().signal,
      }),
    ).rejects.toThrow(/deadline expired/);
  });

  it('rejects when the adapter stages more elements than the policy allows', async () => {
    const oversizedAdapter: ImportAdapter = {
      id: 'oversized',
      version: '1.0.0',
      formatIds: ['pdf'],
      maximumFidelity: 'underlay',
      async convert(): Promise<ImportAdapterResult> {
        return {
          stagedElements: [
            { id: 'a', kind: 'x', properties: {} },
            { id: 'b', kind: 'x', properties: {} },
          ],
          resources: [],
          mappings: [],
          report: {
            formatId: 'pdf',
            adapterId: 'oversized',
            adapterVersion: '1.0.0',
            fidelity: 'underlay',
            sourceSha256: 'abc',
            sourceByteLength: PDF_BYTES.byteLength,
            preservedCount: 0,
            convertedCount: 2,
            approximatedCount: 0,
            ignoredCount: 0,
            issues: [],
            timingsMs: {},
          },
        };
      },
    };

    await expect(
      executeAdapter({
        adapter: oversizedAdapter,
        bytes: PDF_BYTES,
        source,
        sourceSha256: 'abc',
        policy: { ...DEFAULT_IMPORT_POLICY, maxStagedElements: 1 },
        signal: new AbortController().signal,
      }),
    ).rejects.toThrow(/staged-element policy/);
  });
});
