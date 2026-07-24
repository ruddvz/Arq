import { detectFormat } from './detect-format';
import { formatById } from './formats';
import { sha256Hex } from './hash';
import type {
  FormatCandidate,
  ImportAdapter,
  ImportAdapterContext,
  ImportAdapterResult,
  ImportPolicy,
  ImportProgress,
  InputFileDescriptor,
} from './types';

export interface ExecuteAdapterInput {
  readonly adapter: ImportAdapter;
  readonly bytes: Uint8Array;
  readonly source: InputFileDescriptor;
  readonly sourceSha256: string;
  readonly policy: ImportPolicy;
  readonly signal: AbortSignal;
  readonly onProgress?: (progress: ImportProgress) => void;
}

export async function executeAdapter(input: ExecuteAdapterInput): Promise<ImportAdapterResult> {
  if (input.bytes.byteLength !== input.source.byteLength)
    throw new Error('Source byte length changed.');
  if (input.bytes.byteLength > input.policy.maxSourceBytes)
    throw new Error('Source exceeds import policy.');
  if (input.signal.aborted) throw new DOMException('Cancelled', 'AbortError');
  if (input.policy.deadlineUnixMs !== undefined && Date.now() > input.policy.deadlineUnixMs) {
    throw new Error('Import deadline expired.');
  }

  const context: ImportAdapterContext = {
    bytes: input.bytes,
    source: input.source,
    sourceSha256: input.sourceSha256,
    policy: input.policy,
    signal: input.signal,
    ...(input.onProgress ? { onProgress: input.onProgress } : {}),
  };
  input.onProgress?.({ stage: 'converting', fraction: 0, message: `Running ${input.adapter.id}` });
  const result = await input.adapter.convert(context);
  if (result.stagedElements.length > input.policy.maxStagedElements)
    throw new Error('Adapter exceeded staged-element policy.');
  input.onProgress?.({ stage: 'complete', fraction: 1, message: 'Import staged for review' });
  return result;
}

export interface PrepareImportResult {
  readonly sourceSha256: string;
  readonly candidates: readonly FormatCandidate[];
}

export async function prepareImport(
  bytes: Uint8Array,
  source: InputFileDescriptor,
  policy: ImportPolicy,
): Promise<PrepareImportResult> {
  if (bytes.byteLength !== source.byteLength)
    throw new Error('Descriptor length does not match acquired bytes.');
  if (bytes.byteLength > policy.maxSourceBytes) throw new Error('Source exceeds import policy.');
  const candidates = detectFormat(bytes.subarray(0, Math.min(bytes.byteLength, 1_048_576)), source);
  const sourceSha256 = await sha256Hex(bytes);
  return { sourceSha256, candidates };
}

export function routeForCandidate(candidate: FormatCandidate): ReturnType<typeof formatById> {
  return formatById(candidate.formatId);
}
