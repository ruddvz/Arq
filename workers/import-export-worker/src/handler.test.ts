import { describe, expect, it, vi } from 'vitest';
import {
  AdapterRegistry,
  UnderlayAdapter,
  DEFAULT_IMPORT_POLICY,
  serialiseImportPolicy,
  type ImportAdapter,
  type ImportAdapterResult,
} from '@arq/file-ingress';
import { IMPORT_REJECTION_CODES } from '@arq/file-ingress';
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

    // V3-031. This used to assert `IMPORT_WORKER_FAILED`, the code every
    // rejection wore. The test's own name says which refusal this is, so the
    // code it reports should say so too.
    expect(post).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'failed',
        requestId: 'r3',
        code: IMPORT_REJECTION_CODES.adapterUnavailable,
      }),
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

  it('FP-007: rejects a convert request whose expectedSourceSha256 does not match the actual bytes', async () => {
    const handler = createImportWorkerHandler({ adapters: registry() });
    const post = vi.fn<(response: ImportWorkerResponse, transfer?: Transferable[]) => void>();
    const request: ImportWorkerRequest = {
      type: 'convert',
      requestId: 'r6',
      bytes: PDF_BYTES.buffer as ArrayBuffer,
      source: { name: 'underlay.pdf', byteLength: PDF_BYTES.byteLength },
      formatId: 'pdf',
      adapterId: 'underlay',
      policy: serialiseImportPolicy(DEFAULT_IMPORT_POLICY),
      expectedSourceSha256: 'not-the-real-hash',
    };

    await handler(request, post);

    const failed = post.mock.calls.find((call) => call[0]?.type === 'failed')?.[0];
    expect(failed).toBeDefined();
    expect(failed?.type === 'failed' && failed.message).toMatch(/hash changed/i);
    expect(post.mock.calls.some((call) => call[0]?.type === 'converted')).toBe(false);
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

  it('reports why it refused, not just that it did', () => {
    // V3-031. The protocol has carried a code field since it was written and
    // every refusal was IMPORT_WORKER_FAILED, so a caller could not tell an
    // adapter misconfiguration from the source bytes changing under an import.
    const handle = createImportWorkerHandler({ adapters: registry() });
    const post = vi.fn<(response: ImportWorkerResponse) => void>();

    return handle(
      {
        type: 'convert',
        requestId: 'req-1',
        bytes: PDF_BYTES.buffer as ArrayBuffer,
        source: { name: 'a.pdf', byteLength: PDF_BYTES.byteLength },
        formatId: 'pdf',
        adapterId: 'nonexistent-adapter',
        policy: serialiseImportPolicy(DEFAULT_IMPORT_POLICY),
      },
      post,
    ).then(() => {
      expect(post).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'failed',
          code: IMPORT_REJECTION_CODES.adapterRouteMismatch,
        }),
      );
    });
  });

  it('reports a source that changed under the import distinctly', async () => {
    // The one worth telling apart: retrying reads whatever the bytes are now.
    const handle = createImportWorkerHandler({ adapters: registry() });
    const post = vi.fn<(response: ImportWorkerResponse) => void>();

    await handle(
      {
        type: 'convert',
        requestId: 'req-1',
        bytes: PDF_BYTES.buffer as ArrayBuffer,
        source: { name: 'a.pdf', byteLength: PDF_BYTES.byteLength },
        expectedSourceSha256: 'a-digest-these-bytes-do-not-have',
        formatId: 'pdf',
        adapterId: 'underlay',
        policy: serialiseImportPolicy(DEFAULT_IMPORT_POLICY),
      },
      post,
    );

    expect(post).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'failed',
        code: IMPORT_REJECTION_CODES.sourceDigestChanged,
      }),
    );
  });

  it('does not let a cancel for an unknown request swallow a later one', async () => {
    // V3-029. Remembering every cancelled id left a trap: a reused id would
    // silently suppress the new request's final message and the caller would
    // never hear back.
    const handle = createImportWorkerHandler({ adapters: registry() });
    const post = vi.fn<(response: ImportWorkerResponse) => void>();

    await handle({ type: 'cancel', requestId: 'req-1' }, post);
    post.mockClear();

    await handle(
      {
        type: 'detect',
        requestId: 'req-1',
        bytes: PDF_BYTES.buffer as ArrayBuffer,
        source: { name: 'a.pdf', byteLength: PDF_BYTES.byteLength },
      },
      post,
    );

    expect(post.mock.calls.map((call) => call[0]?.type)).toEqual(['detected']);
  });
});
