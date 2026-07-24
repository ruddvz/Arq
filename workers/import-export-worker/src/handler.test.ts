import { describe, expect, it, vi } from 'vitest';
import {
  AdapterRegistry,
  UnderlayAdapter,
  DEFAULT_IMPORT_POLICY,
  serialiseImportPolicy,
  type ImportAdapter,
  type ImportAdapterResult,
} from '@arq/file-ingress';
import { createImportWorkerHandler } from './handler';
import type { ImportWorkerRequest, ImportWorkerResponse } from './protocol';

function registry(): AdapterRegistry {
  const reg = new AdapterRegistry();
  reg.register(new UnderlayAdapter());
  return reg;
}

const PDF_BYTES = new TextEncoder().encode('%PDF-1.7\nrest of a minimal pdf');

describe('createImportWorkerHandler', () => {
  it('responds with detected candidates for a detect request', async () => {
    const handler = createImportWorkerHandler({ adapters: registry() });
    const post = vi.fn<(response: ImportWorkerResponse, transfer?: Transferable[]) => void>();
    const request: ImportWorkerRequest = {
      type: 'detect',
      requestId: 'r1',
      bytes: PDF_BYTES.buffer as ArrayBuffer,
      source: { name: 'underlay.pdf', byteLength: PDF_BYTES.byteLength },
    };

    await handler(request, post);

    expect(post).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'detected', requestId: 'r1' }),
    );
    const call = post.mock.calls[0]?.[0];
    expect(call?.type === 'detected' && call.candidates[0]?.formatId).toBe('pdf');
  });

  it('converts via the registered adapter and posts the staged result', async () => {
    const handler = createImportWorkerHandler({ adapters: registry() });
    const post = vi.fn<(response: ImportWorkerResponse, transfer?: Transferable[]) => void>();
    const request: ImportWorkerRequest = {
      type: 'convert',
      requestId: 'r2',
      bytes: PDF_BYTES.buffer as ArrayBuffer,
      source: { name: 'underlay.pdf', byteLength: PDF_BYTES.byteLength },
      formatId: 'pdf',
      adapterId: 'underlay',
      policy: serialiseImportPolicy(DEFAULT_IMPORT_POLICY),
    };

    await handler(request, post);

    const converted = post.mock.calls.find((call) => call[0]?.type === 'converted')?.[0];
    expect(converted).toBeDefined();
    expect(converted?.type === 'converted' && converted.result.report.fidelity).toBe('underlay');
  });

  it('fails cleanly when the requested adapter is not registered', async () => {
    const handler = createImportWorkerHandler({ adapters: new AdapterRegistry() });
    const post = vi.fn<(response: ImportWorkerResponse, transfer?: Transferable[]) => void>();
    const request: ImportWorkerRequest = {
      type: 'convert',
      requestId: 'r3',
      bytes: PDF_BYTES.buffer as ArrayBuffer,
      source: { name: 'underlay.pdf', byteLength: PDF_BYTES.byteLength },
      formatId: 'pdf',
      adapterId: 'underlay',
      policy: serialiseImportPolicy(DEFAULT_IMPORT_POLICY),
    };

    await handler(request, post);

    expect(post).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'failed', requestId: 'r3', code: 'IMPORT_WORKER_FAILED' }),
    );
  });

  it('rejects native Arq files - they use the direct open path, not this worker', async () => {
    const handler = createImportWorkerHandler({ adapters: registry() });
    const post = vi.fn<(response: ImportWorkerResponse, transfer?: Transferable[]) => void>();
    const request: ImportWorkerRequest = {
      type: 'convert',
      requestId: 'r4',
      bytes: PDF_BYTES.buffer as ArrayBuffer,
      source: { name: 'project.arq', byteLength: PDF_BYTES.byteLength },
      formatId: 'arq-native',
      adapterId: 'native-arq',
      policy: serialiseImportPolicy(DEFAULT_IMPORT_POLICY),
    };

    await handler(request, post);

    const failed = post.mock.calls.find((call) => call[0]?.type === 'failed')?.[0];
    expect(failed?.type === 'failed' && failed.message).toMatch(/direct open path/);
  });

  it('acknowledges a cancel request for an id with no active conversion', async () => {
    const handler = createImportWorkerHandler({ adapters: registry() });
    const post = vi.fn<(response: ImportWorkerResponse, transfer?: Transferable[]) => void>();

    await handler({ type: 'cancel', requestId: 'unknown' }, post);

    expect(post).toHaveBeenCalledWith({ type: 'cancelled', requestId: 'unknown' });
  });

  it('FP-019: never posts a converted/failed result for a request already reported cancelled', async () => {
    // A fake adapter whose convert() only resolves once the test explicitly
    // lets it, so cancel can arrive while it is genuinely still in flight -
    // reproducing the real race, not just asserting the code path exists.
    let resolveConvert: (result: ImportAdapterResult) => void = () => {};
    const slowAdapter: ImportAdapter = {
      id: 'underlay',
      version: '1.0.0',
      formatIds: ['pdf'],
      maximumFidelity: 'underlay',
      convert: () => new Promise((resolve) => (resolveConvert = resolve)),
    };
    const reg = new AdapterRegistry();
    reg.register(slowAdapter);

    const handler = createImportWorkerHandler({ adapters: reg });
    const post = vi.fn<(response: ImportWorkerResponse, transfer?: Transferable[]) => void>();
    const convertRequest: ImportWorkerRequest = {
      type: 'convert',
      requestId: 'r5',
      bytes: PDF_BYTES.buffer as ArrayBuffer,
      source: { name: 'underlay.pdf', byteLength: PDF_BYTES.byteLength },
      formatId: 'pdf',
      adapterId: 'underlay',
      policy: serialiseImportPolicy(DEFAULT_IMPORT_POLICY),
    };

    const conversion = handler(convertRequest, post);
    await handler({ type: 'cancel', requestId: 'r5' }, post);

    expect(post).toHaveBeenCalledWith({ type: 'cancelled', requestId: 'r5' });

    // The adapter finishes normally *after* cancellation was already reported.
    resolveConvert({
      stagedElements: [],
      resources: [],
      mappings: [],
      report: {
        formatId: 'pdf',
        adapterId: 'underlay',
        adapterVersion: '1.0.0',
        fidelity: 'underlay',
        sourceSha256: 'x',
        sourceByteLength: PDF_BYTES.byteLength,
        preservedCount: 0,
        convertedCount: 0,
        approximatedCount: 0,
        ignoredCount: 0,
        issues: [],
        timingsMs: {},
      },
    });
    await conversion;

    const postedTypes = post.mock.calls.map((call) => call[0]?.type);
    expect(postedTypes).toEqual(['cancelled']);
    expect(postedTypes).not.toContain('converted');
    expect(postedTypes).not.toContain('failed');
  });
});
