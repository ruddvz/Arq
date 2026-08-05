import type { ImportPolicy } from './types';

/**
 * V3-182: a compressed source is bounded while it is being read, not after.
 *
 * `ImportPolicy.maxSourceBytes` bounds the file on disk, which is the number an
 * attacker controls least. A 2MB zip can hold 4GB of zeros; an IFC in gzip, an
 * SVG with an embedded compressed stream, a DWG's internal sections all have
 * the same shape. The file passes every check that looks at its size, and the
 * process dies expanding it - or worse, does not die, and swaps for ten minutes
 * while the tab becomes unusable and the user has no idea why.
 *
 * Two limits, and the second is the one that matters.
 *
 * An absolute cap on decompressed bytes is necessary and not sufficient: a
 * legitimate 800MB IFC and a 40KB bomb expanding to 800MB both hit it, so
 * setting it low enough to stop the bomb early rejects real files and setting
 * it high enough for real files means reading 800MB of an attack.
 *
 * The ratio between output and input is what separates them. Real architectural
 * data compresses well - text-heavy IFC reaches 20:1, and generous headroom
 * puts the limit near 200:1 - while a bomb is 1000:1 upwards by construction,
 * because that is the entire technique. Checking the ratio *continuously* means
 * a bomb is refused after a few megabytes rather than after all of them.
 *
 * Both are checked as bytes arrive, which is why this is a small state machine
 * rather than a function over a finished buffer. A check that can only run on
 * the complete output is a check that runs after the damage.
 */

/** Generous: real text-heavy formats reach roughly 20:1, so this leaves an order of magnitude. */
export const DEFAULT_MAX_COMPRESSION_RATIO = 200;

/**
 * Below this, the ratio is not evidence. A 40-byte input expanding to 12KB is
 * 300:1 and completely ordinary - a gzip header alone distorts the ratio at
 * small sizes. The guard only starts once enough has been read for the number
 * to mean something.
 */
export const RATIO_CHECK_FLOOR_BYTES = 1 << 20;

export interface DecompressionLimits {
  /** Hard ceiling on what may be produced, whatever the ratio says. */
  readonly maxDecompressedBytes: number;
  readonly maxCompressionRatio: number;
  /** Bytes of output below which the ratio is not evaluated. */
  readonly ratioCheckFloorBytes: number;
}

export function decompressionLimitsFor(policy: ImportPolicy): DecompressionLimits {
  return {
    // The decompressed cap is derived from the source cap rather than being a
    // second unrelated number, so raising one does not silently leave the other
    // behind - which is how a policy change becomes a hole.
    maxDecompressedBytes: policy.maxSourceBytes,
    maxCompressionRatio: DEFAULT_MAX_COMPRESSION_RATIO,
    ratioCheckFloorBytes: RATIO_CHECK_FLOOR_BYTES,
  };
}

export const DECOMPRESSION_REFUSAL_CODES = {
  outputTooLarge: 'ARQ_IMPORT_DECOMPRESSED_TOO_LARGE',
  ratioTooHigh: 'ARQ_IMPORT_COMPRESSION_RATIO_TOO_HIGH',
  emptyInput: 'ARQ_IMPORT_EMPTY_COMPRESSED_INPUT',
} as const;

export type DecompressionRefusalCode =
  (typeof DECOMPRESSION_REFUSAL_CODES)[keyof typeof DECOMPRESSION_REFUSAL_CODES];

export type DecompressionVerdict =
  | { readonly status: 'continue' }
  | {
      readonly status: 'refused';
      readonly code: DecompressionRefusalCode;
      readonly detail: string;
      readonly decompressedBytes: number;
      readonly ratio: number;
    };

/**
 * Tracks a decompression in progress.
 *
 * `accept` is called with each chunk's length as it is produced and returns
 * whether to keep going. It is deliberately not given the chunk: this decides
 * whether reading may continue, and a guard that also held the data would
 * invite a caller to treat its return value as the data path and forget to
 * check it.
 */
export function createDecompressionGuard(compressedBytes: number, limits: DecompressionLimits) {
  let produced = 0;
  let refused: DecompressionVerdict | null = null;

  function ratio(): number {
    // A zero-length input cannot produce output, so any output from one is
    // already wrong; reporting Infinity rather than dividing by zero keeps the
    // number honest for a log.
    return compressedBytes === 0 ? Number.POSITIVE_INFINITY : produced / compressedBytes;
  }

  function accept(chunkByteLength: number): DecompressionVerdict {
    if (refused !== null) {
      // Once refused, stays refused. A caller that keeps feeding chunks after a
      // refusal must not be able to walk it back by feeding a small one.
      return refused;
    }

    produced += chunkByteLength;

    if (compressedBytes === 0 && produced > 0) {
      refused = {
        status: 'refused',
        code: DECOMPRESSION_REFUSAL_CODES.emptyInput,
        detail: 'an empty compressed input produced output',
        decompressedBytes: produced,
        ratio: ratio(),
      };
      return refused;
    }

    if (produced > limits.maxDecompressedBytes) {
      refused = {
        status: 'refused',
        code: DECOMPRESSION_REFUSAL_CODES.outputTooLarge,
        detail: `decompressed ${produced} bytes, over the ${limits.maxDecompressedBytes} byte limit`,
        decompressedBytes: produced,
        ratio: ratio(),
      };
      return refused;
    }

    if (produced >= limits.ratioCheckFloorBytes && ratio() > limits.maxCompressionRatio) {
      refused = {
        status: 'refused',
        code: DECOMPRESSION_REFUSAL_CODES.ratioTooHigh,
        detail: `expanded ${ratio().toFixed(0)}:1, over the ${limits.maxCompressionRatio}:1 limit`,
        decompressedBytes: produced,
        ratio: ratio(),
      };
      return refused;
    }

    return { status: 'continue' };
  }

  return {
    accept,
    decompressedBytes: () => produced,
    ratio,
    refusal: () => refused,
  };
}

export type DecompressionGuard = ReturnType<typeof createDecompressionGuard>;

/**
 * A sentence for a user whose file was refused.
 *
 * Phrased as a property of the file rather than as an accusation. Most files
 * that trip a ratio limit are not attacks - they are a legitimate archive of
 * ten thousand near-identical elements - and telling that user their file
 * looked malicious is both wrong and unhelpful. What they need is the number
 * and the fact that it can be raised.
 */
export function describeDecompressionRefusal(verdict: DecompressionVerdict): string | null {
  if (verdict.status === 'continue') {
    return null;
  }
  switch (verdict.code) {
    case DECOMPRESSION_REFUSAL_CODES.outputTooLarge:
      return `This file expands to more than the import size limit allows. Arq stopped reading it at ${formatBytes(verdict.decompressedBytes)}.`;
    case DECOMPRESSION_REFUSAL_CODES.ratioTooHigh:
      return `This file expands to about ${verdict.ratio.toFixed(0)} times its stored size, which is beyond the import limit. Arq stopped reading it at ${formatBytes(verdict.decompressedBytes)}.`;
    case DECOMPRESSION_REFUSAL_CODES.emptyInput:
      return 'This file reports no compressed content but produced data. Arq stopped reading it.';
  }
}

function formatBytes(bytes: number): string {
  if (bytes >= 1 << 20) {
    return `${(bytes / (1 << 20)).toFixed(1)}MB`;
  }
  if (bytes >= 1 << 10) {
    return `${(bytes / (1 << 10)).toFixed(1)}KB`;
  }
  return `${bytes} bytes`;
}
