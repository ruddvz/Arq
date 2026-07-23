import { describe, expect, it } from 'vitest';
import {
  exceedsJsonComplexityLimits,
  totalArchiveBytes,
  MAX_ARCHIVE_TOTAL_BYTES,
  MAX_JSON_NODE_COUNT,
  MAX_JSON_DEPTH,
} from './complexity-limits';

describe('totalArchiveBytes', () => {
  it('sums every entry byte length', () => {
    const entries = new Map<string, Uint8Array>([
      ['a', new Uint8Array(10)],
      ['b', new Uint8Array(20)],
    ]);
    expect(totalArchiveBytes(entries)).toBe(30);
  });

  it('returns 0 for an empty archive', () => {
    expect(totalArchiveBytes(new Map())).toBe(0);
  });
});

describe('exceedsJsonComplexityLimits', () => {
  it('does not flag a small, realistic BIM-shaped model', () => {
    const model = {
      levels: [
        {
          id: 'level-1',
          walls: Array.from({ length: 150 }, (_, i) => ({
            id: `wall-${i}`,
            start: { x: 0, y: 0 },
            end: { x: 1, y: 1 },
          })),
          rooms: Array.from({ length: 60 }, (_, i) => ({ id: `room-${i}`, name: `Room ${i}` })),
        },
      ],
    };
    expect(exceedsJsonComplexityLimits(model)).toEqual({ exceeded: false });
  });

  it('flags a value whose node count exceeds MAX_JSON_NODE_COUNT', () => {
    const hugeArray = Array.from({ length: MAX_JSON_NODE_COUNT + 10 }, (_, i) => i);
    const result = exceedsJsonComplexityLimits(hugeArray);
    expect(result.exceeded).toBe(true);
    expect(result.reason).toContain('node limit');
  });

  it('flags a value nested deeper than MAX_JSON_DEPTH', () => {
    let deeplyNested: unknown = 'leaf';
    for (let i = 0; i < MAX_JSON_DEPTH + 10; i += 1) {
      deeplyNested = { child: deeplyNested };
    }
    const result = exceedsJsonComplexityLimits(deeplyNested);
    expect(result.exceeded).toBe(true);
    expect(result.reason).toContain('nesting-depth limit');
  });

  it('never overflows the call stack for a very deeply nested value (iterative traversal)', () => {
    let deeplyNested: unknown = 'leaf';
    for (let i = 0; i < 200_000; i += 1) {
      deeplyNested = { child: deeplyNested };
    }
    expect(() => exceedsJsonComplexityLimits(deeplyNested)).not.toThrow();
    expect(exceedsJsonComplexityLimits(deeplyNested).exceeded).toBe(true);
  });

  it('does not flag primitive values', () => {
    expect(exceedsJsonComplexityLimits(null)).toEqual({ exceeded: false });
    expect(exceedsJsonComplexityLimits(42)).toEqual({ exceeded: false });
    expect(exceedsJsonComplexityLimits('hello')).toEqual({ exceeded: false });
  });
});

describe('MAX_ARCHIVE_TOTAL_BYTES', () => {
  it('is a positive finite number', () => {
    expect(Number.isFinite(MAX_ARCHIVE_TOTAL_BYTES)).toBe(true);
    expect(MAX_ARCHIVE_TOTAL_BYTES).toBeGreaterThan(0);
  });
});
