import { describe, expect, it } from 'vitest';
import { DEFAULT_IMPORT_POLICY } from './policy';
import {
  DECOMPRESSION_REFUSAL_CODES,
  DEFAULT_MAX_COMPRESSION_RATIO,
  RATIO_CHECK_FLOOR_BYTES,
  createDecompressionGuard,
  decompressionLimitsFor,
  describeDecompressionRefusal,
  type DecompressionLimits,
} from './decompression-limits';

const LIMITS: DecompressionLimits = {
  maxDecompressedBytes: 10 * (1 << 20),
  maxCompressionRatio: DEFAULT_MAX_COMPRESSION_RATIO,
  ratioCheckFloorBytes: RATIO_CHECK_FLOOR_BYTES,
};

/** Feeds `total` bytes in 64KB chunks and returns the first non-continue verdict. */
function feed(guard: ReturnType<typeof createDecompressionGuard>, total: number) {
  const chunk = 64 * (1 << 10);
  let fed = 0;
  while (fed < total) {
    const size = Math.min(chunk, total - fed);
    const verdict = guard.accept(size);
    fed += size;
    if (verdict.status === 'refused') {
      return verdict;
    }
  }
  return { status: 'continue' as const };
}

describe('createDecompressionGuard', () => {
  it('lets an ordinary file through', () => {
    // 4MB from 400KB is 10:1, which is unremarkable for text-heavy data.
    const guard = createDecompressionGuard(400 * (1 << 10), LIMITS);

    expect(feed(guard, 4 * (1 << 20)).status).toBe('continue');
    expect(guard.refusal()).toBeNull();
  });

  it('lets a well-compressing real format through', () => {
    // 20:1 is what a text-heavy IFC actually reaches.
    const guard = createDecompressionGuard(400 * (1 << 10), LIMITS);

    expect(feed(guard, 8 * (1 << 20)).status).toBe('continue');
  });

  it('refuses a bomb on ratio, long before the size limit', () => {
    // 2KB expanding towards gigabytes: refused after a couple of megabytes,
    // not after all of them.
    const guard = createDecompressionGuard(2 * (1 << 10), LIMITS);
    const verdict = feed(guard, 10 * (1 << 20));

    expect(verdict.status).toBe('refused');
    if (verdict.status !== 'refused') return;
    expect(verdict.code).toBe(DECOMPRESSION_REFUSAL_CODES.ratioTooHigh);
    // Stopped near the floor rather than after the whole 10MB.
    expect(verdict.decompressedBytes).toBeLessThan(2 * (1 << 20));
  });

  it('refuses on absolute size even when the ratio is respectable', () => {
    // A genuinely enormous file that compresses normally still has to stop.
    const guard = createDecompressionGuard(4 * (1 << 20), LIMITS);
    const verdict = feed(guard, 12 * (1 << 20));

    expect(verdict.status).toBe('refused');
    if (verdict.status !== 'refused') return;
    expect(verdict.code).toBe(DECOMPRESSION_REFUSAL_CODES.outputTooLarge);
  });

  it('does not judge the ratio before there is enough output to judge', () => {
    // A 40-byte input expanding to 12KB is 300:1 and completely ordinary.
    const guard = createDecompressionGuard(40, LIMITS);

    expect(guard.accept(12 * (1 << 10)).status).toBe('continue');
    expect(guard.ratio()).toBeGreaterThan(DEFAULT_MAX_COMPRESSION_RATIO);
  });

  it('starts judging once past the floor', () => {
    const guard = createDecompressionGuard(40, LIMITS);
    const verdict = feed(guard, RATIO_CHECK_FLOOR_BYTES + 1024);

    expect(verdict.status).toBe('refused');
    if (verdict.status !== 'refused') return;
    expect(verdict.code).toBe(DECOMPRESSION_REFUSAL_CODES.ratioTooHigh);
  });

  it('refuses output from an empty compressed input', () => {
    const guard = createDecompressionGuard(0, LIMITS);
    const verdict = guard.accept(1);

    expect(verdict.status).toBe('refused');
    if (verdict.status !== 'refused') return;
    expect(verdict.code).toBe(DECOMPRESSION_REFUSAL_CODES.emptyInput);
  });

  it('stays refused once refused', () => {
    // A caller that keeps feeding must not walk a refusal back with a small
    // chunk.
    const guard = createDecompressionGuard(2 * (1 << 10), LIMITS);
    feed(guard, 10 * (1 << 20));

    expect(guard.accept(1).status).toBe('refused');
    expect(guard.refusal()).not.toBeNull();
  });

  it('reports how far it got, for a log', () => {
    const guard = createDecompressionGuard(1 << 10, LIMITS);
    feed(guard, 4 * (1 << 20));

    expect(guard.decompressedBytes()).toBeGreaterThan(0);
    expect(guard.ratio()).toBeGreaterThan(DEFAULT_MAX_COMPRESSION_RATIO);
  });

  it('accepts a zero-length chunk without counting it as expansion', () => {
    const guard = createDecompressionGuard(1 << 20, LIMITS);

    expect(guard.accept(0).status).toBe('continue');
    expect(guard.decompressedBytes()).toBe(0);
  });
});

describe('decompressionLimitsFor', () => {
  it('derives the decompressed cap from the source cap', () => {
    // Two unrelated numbers is how raising one leaves the other behind, which
    // is how a policy change becomes a hole.
    const limits = decompressionLimitsFor(DEFAULT_IMPORT_POLICY);

    expect(limits.maxDecompressedBytes).toBe(DEFAULT_IMPORT_POLICY.maxSourceBytes);
    expect(limits.maxCompressionRatio).toBe(DEFAULT_MAX_COMPRESSION_RATIO);
  });

  it('leaves an order of magnitude over what real formats reach', () => {
    // Text-heavy IFC reaches roughly 20:1.
    expect(DEFAULT_MAX_COMPRESSION_RATIO).toBeGreaterThanOrEqual(100);
  });
});

describe('describeDecompressionRefusal', () => {
  it('says nothing while a read is continuing', () => {
    expect(describeDecompressionRefusal({ status: 'continue' })).toBeNull();
  });

  it('states a property of the file rather than an accusation', () => {
    // Most files that trip a ratio limit are an archive of ten thousand
    // near-identical elements, not an attack.
    const guard = createDecompressionGuard(2 * (1 << 10), LIMITS);
    const verdict = feed(guard, 10 * (1 << 20));
    const sentence = describeDecompressionRefusal(verdict);

    expect(sentence).toContain('times its stored size');
    expect(sentence).not.toMatch(/malicious|attack|bomb/i);
  });

  it('gives the size it stopped at, so the number is actionable', () => {
    const guard = createDecompressionGuard(4 * (1 << 20), LIMITS);
    const verdict = feed(guard, 12 * (1 << 20));

    expect(describeDecompressionRefusal(verdict)).toMatch(/MB/);
  });
});
