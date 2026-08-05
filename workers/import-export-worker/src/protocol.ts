import type {
  ImportAdapterResult,
  ImportProgress,
  InputFileDescriptor,
  SerializableImportPolicy,
} from '@arq/file-ingress';

export type ImportWorkerRequest =
  | {
      readonly type: 'detect';
      readonly requestId: string;
      readonly bytes: ArrayBuffer;
      readonly source: InputFileDescriptor;
    }
  | {
      readonly type: 'convert';
      readonly requestId: string;
      readonly bytes: ArrayBuffer;
      readonly source: InputFileDescriptor;
      readonly expectedSourceSha256?: string;
      readonly formatId: string;
      readonly adapterId: string;
      readonly policy: SerializableImportPolicy;
    }
  | { readonly type: 'cancel'; readonly requestId: string };

export type ImportWorkerResponse =
  | { readonly type: 'progress'; readonly requestId: string; readonly progress: ImportProgress }
  | {
      readonly type: 'detected';
      readonly requestId: string;
      readonly candidates: readonly {
        readonly formatId: string;
        readonly confidence: number;
        readonly evidence: readonly string[];
        readonly extensionMismatch: boolean;
      }[];
    }
  | { readonly type: 'converted'; readonly requestId: string; readonly result: ImportAdapterResult }
  | { readonly type: 'cancelled'; readonly requestId: string }
  | {
      readonly type: 'failed';
      readonly requestId: string;
      readonly code: string;
      readonly message: string;
    };

/**
 * V3-021: the request boundary, checked at runtime rather than asserted.
 *
 * The same reasoning as `parseArqfsWorkerRequest` in @arq/arqfs, applied to the
 * other Worker in the system: `event.data` arrives from another execution
 * context, so `MessageEvent<ImportWorkerRequest>` states what a caller is meant
 * to send, not what did arrive.
 *
 * The failure this prevents is quieter here than in the arqfs Worker, and worse
 * for it. There is no `default` to fall out of - a request with no recognised
 * `type` is simply not `'cancel'` and not `'detect'`, so it took the convert
 * path, reached `formatById(undefined)`, and came back as
 * `ARQ_IMPORT_NATIVE_FILE_MISROUTED`: a confident, specific diagnosis of a
 * problem the caller does not have. Malformed input should be reported as
 * malformed, not classified as the nearest recognised fault.
 */
export function parseImportWorkerRequest(value: unknown): ImportWorkerRequest | null {
  if (value === null || typeof value !== 'object') return null;
  const candidate = value as Record<string, unknown>;
  if (typeof candidate['requestId'] !== 'string' || candidate['requestId'] === '') return null;
  const requestId = candidate['requestId'];

  if (candidate['type'] === 'cancel') return { type: 'cancel', requestId };

  const bytes = candidate['bytes'];
  const source = candidate['source'];
  if (!(bytes instanceof ArrayBuffer)) return null;
  if (source === null || typeof source !== 'object') return null;
  const descriptor = source as Record<string, unknown>;
  if (typeof descriptor['name'] !== 'string' || typeof descriptor['byteLength'] !== 'number') {
    return null;
  }

  if (candidate['type'] === 'detect') {
    return { type: 'detect', requestId, bytes, source: source as InputFileDescriptor };
  }
  if (candidate['type'] !== 'convert') return null;
  if (typeof candidate['formatId'] !== 'string' || typeof candidate['adapterId'] !== 'string') {
    return null;
  }
  const policy = candidate['policy'];
  if (policy === null || typeof policy !== 'object') return null;
  const expected = candidate['expectedSourceSha256'];
  if (expected !== undefined && typeof expected !== 'string') return null;

  return {
    type: 'convert',
    requestId,
    bytes,
    source: source as InputFileDescriptor,
    ...(expected === undefined ? {} : { expectedSourceSha256: expected }),
    formatId: candidate['formatId'],
    adapterId: candidate['adapterId'],
    policy: policy as SerializableImportPolicy,
  };
}

/** The id to refuse under when the request did not parse; see `correlationIdOf` in @arq/arqfs. */
export function importCorrelationIdOf(value: unknown): string | null {
  if (value === null || typeof value !== 'object') return null;
  const id = (value as Record<string, unknown>)['requestId'];
  return typeof id === 'string' && id !== '' ? id : null;
}
