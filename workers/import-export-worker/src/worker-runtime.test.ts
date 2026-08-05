import { describe, expect, it, vi } from 'vitest';
import { DEFAULT_IMPORT_POLICY, serialiseImportPolicy } from '@arq/file-ingress';
import { installImportExportWorker } from './worker-runtime';
import { importCorrelationIdOf, parseImportWorkerRequest } from './protocol';
import type { ImportWorkerResponse } from './protocol';

/**
 * V3-021. The Worker message boundary, exercised with the values a boundary
 * actually receives rather than the ones its type says it receives.
 */

function scope() {
  const posted: ImportWorkerResponse[] = [];
  let listener: ((event: MessageEvent<unknown>) => void) | null = null;
  installImportExportWorker({
    addEventListener: (_type, handler) => {
      listener = handler;
    },
    postMessage: (message) => {
      posted.push(message);
    },
  });
  return {
    posted,
    send(data: unknown): void {
      listener?.({ data } as MessageEvent<unknown>);
    },
  };
}

describe('import worker request parsing', () => {
  it('refuses a request whose type is not in the protocol, rather than diagnosing a misrouted native file', () => {
    // Before the parser existed this took the convert path, reached
    // formatById(undefined) and came back as ARQ_IMPORT_NATIVE_FILE_MISROUTED -
    // a confident answer to a question the caller had not asked.
    expect(parseImportWorkerRequest({ type: 'exec', requestId: 'r1' })).toBeNull();
  });

  it.each([
    ['not an object', 42],
    ['null', null],
    ['no requestId', { type: 'cancel' }],
    ['empty requestId', { type: 'cancel', requestId: '' }],
    ['non-string requestId', { type: 'cancel', requestId: 7 }],
    [
      'convert without bytes',
      { type: 'convert', requestId: 'r', source: { name: 'a', byteLength: 1 } },
    ],
    ['convert with non-ArrayBuffer bytes', { type: 'convert', requestId: 'r', bytes: 'nope' }],
    [
      'detect without a source descriptor',
      { type: 'detect', requestId: 'r', bytes: new ArrayBuffer(1) },
    ],
    [
      'source missing byteLength',
      { type: 'detect', requestId: 'r', bytes: new ArrayBuffer(1), source: { name: 'a.pdf' } },
    ],
  ])('rejects %s', (_label, value) => {
    expect(parseImportWorkerRequest(value)).toBeNull();
  });

  it('accepts a cancel without demanding the fields only a convert needs', () => {
    expect(parseImportWorkerRequest({ type: 'cancel', requestId: 'r1' })).toEqual({
      type: 'cancel',
      requestId: 'r1',
    });
  });

  it('keeps expectedSourceSha256 absent rather than present-and-undefined', () => {
    const parsed = parseImportWorkerRequest({
      type: 'convert',
      requestId: 'r1',
      bytes: new ArrayBuffer(4),
      source: { name: 'a.pdf', byteLength: 4 },
      formatId: 'pdf',
      adapterId: 'underlay',
      policy: serialiseImportPolicy(DEFAULT_IMPORT_POLICY),
    });
    expect(parsed).not.toBeNull();
    // exactOptionalPropertyTypes: an absent optional and one set to undefined are
    // not the same value, and only one of them round-trips through structuredClone.
    expect(parsed !== null && 'expectedSourceSha256' in parsed).toBe(false);
  });

  it('rejects a convert whose expectedSourceSha256 is present but not a string', () => {
    expect(
      parseImportWorkerRequest({
        type: 'convert',
        requestId: 'r1',
        bytes: new ArrayBuffer(4),
        source: { name: 'a.pdf', byteLength: 4 },
        formatId: 'pdf',
        adapterId: 'underlay',
        policy: serialiseImportPolicy(DEFAULT_IMPORT_POLICY),
        expectedSourceSha256: 12345,
      }),
    ).toBeNull();
  });
});

describe('import worker correlation id recovery', () => {
  it('recovers the id from an otherwise malformed request so the refusal can be delivered', () => {
    expect(importCorrelationIdOf({ type: 'nonsense', requestId: 'r9' })).toBe('r9');
  });

  it('reports no id when there is none to recover', () => {
    expect(importCorrelationIdOf({ type: 'nonsense' })).toBeNull();
    expect(importCorrelationIdOf(null)).toBeNull();
  });
});

describe('import worker runtime', () => {
  it('answers a malformed request immediately instead of letting the caller time out', () => {
    const worker = scope();
    worker.send({ type: 'exec', requestId: 'r1', sql: 'DROP TABLE elements' });

    expect(worker.posted).toEqual([
      {
        type: 'failed',
        requestId: 'r1',
        code: 'ARQ_IMPORT_MALFORMED_REQUEST',
        message: expect.stringContaining('Nothing was attempted'),
      },
    ]);
  });

  it('stays silent when there is no id to answer under, rather than settling another request', () => {
    const worker = scope();
    worker.send({ type: 'exec' });
    worker.send('a string');
    worker.send(null);

    expect(worker.posted).toEqual([]);
  });

  it('passes a well-formed request through to the handler', async () => {
    const worker = scope();
    worker.send({ type: 'cancel', requestId: 'r1' });
    await vi.waitFor(() => expect(worker.posted.length).toBe(1));

    expect(worker.posted[0]).toEqual({ type: 'cancelled', requestId: 'r1' });
  });
});
