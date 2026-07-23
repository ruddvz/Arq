/**
 * ARQ-157: security: add file size and complexity limits.
 *
 * Two limits, both applied before any of an archive's content is trusted,
 * neither requiring knowledge of wall/room/opening semantics (project-format
 * has no @arq/bim-core dependency, and this issue's own non-goal rules out
 * coupling project semantics to this layer):
 *
 * - `MAX_ARCHIVE_TOTAL_BYTES`: a whole-archive size cap, on top of
 *   archive.ts's existing per-entry `MAX_ENTRY_BYTES` (ARQ-079) - many
 *   entries each just under the per-entry cap could otherwise still sum to
 *   an unbounded total.
 * - `exceedsJsonComplexityLimits`: a generic structural cap on a parsed
 *   JSON value's node count and nesting depth, applied to model.json (the
 *   one required section whose content this package actually parses).
 *   This catches a maliciously huge or deeply-nested JSON payload
 *   regardless of what domain it claims to describe - the same role
 *   MAX_ENTRY_BYTES plays for raw bytes, one level up at the parsed-value
 *   level. Traversal is iterative (an explicit stack, not recursion) so
 *   that walking a hostile deeply-nested value cannot itself overflow the
 *   call stack - the exact failure mode this check exists to guard
 *   against elsewhere in the pipeline.
 *
 * Neither limit is the primary zip-bomb defense (that belongs at the
 * not-yet-chosen compressed-container layer, same caveat as
 * MAX_ENTRY_BYTES - see ARQ-238) - both are real, tested defense-in-depth
 * once bytes are already decoded and parsed.
 */

/**
 * Whole-archive size cap: sum of every entry's byte length. Roughly twice
 * archive.ts's own MAX_ENTRY_BYTES (500 MiB) - a standalone constant
 * rather than a direct reference to it, since archive.ts imports this
 * module and importing back would be circular. Gives headroom for a
 * couple of near-cap-sized entries (a large model plus a large import)
 * without permitting an unbounded total across many entries.
 */
export const MAX_ARCHIVE_TOTAL_BYTES = 1024 * 1024 * 1024;

/**
 * Generous headroom above the benchmark model's semanticObjectsApprox:1000
 * (benchmarks/PERFORMANCE-BUDGETS.json) - each semantic object's own
 * properties and nested arrays (points, references, ...) easily multiply
 * into the tens of thousands of JSON nodes for a real project at that
 * scale, so this is sized to comfortably clear real usage while still
 * bounding a hostile payload.
 */
export const MAX_JSON_NODE_COUNT = 500_000;

/** Real BIM data nests only a few levels deep (project -> level -> element -> point); this is generous headroom for that, not a tight fit. */
export const MAX_JSON_DEPTH = 64;

export interface JsonComplexityResult {
  readonly exceeded: boolean;
  readonly reason?: string;
}

interface StackFrame {
  readonly value: unknown;
  readonly depth: number;
}

/** Iteratively walks a parsed JSON value, counting nodes and tracking maximum depth; returns as soon as either budget is exceeded. */
export function exceedsJsonComplexityLimits(value: unknown): JsonComplexityResult {
  const stack: StackFrame[] = [{ value, depth: 1 }];
  let nodeCount = 0;

  while (stack.length > 0) {
    const frame = stack.pop();
    if (frame === undefined) {
      continue;
    }
    nodeCount += 1;
    if (nodeCount > MAX_JSON_NODE_COUNT) {
      return { exceeded: true, reason: `exceeds ${MAX_JSON_NODE_COUNT} JSON node limit` };
    }
    if (frame.depth > MAX_JSON_DEPTH) {
      return { exceeded: true, reason: `exceeds ${MAX_JSON_DEPTH} JSON nesting-depth limit` };
    }
    if (Array.isArray(frame.value)) {
      for (const element of frame.value) {
        stack.push({ value: element, depth: frame.depth + 1 });
      }
    } else if (typeof frame.value === 'object' && frame.value !== null) {
      for (const key of Object.keys(frame.value)) {
        stack.push({
          value: (frame.value as Record<string, unknown>)[key],
          depth: frame.depth + 1,
        });
      }
    }
  }

  return { exceeded: false };
}

/** Sums every archive entry's byte length; the caller compares this against MAX_ARCHIVE_TOTAL_BYTES. */
export function totalArchiveBytes(entries: ReadonlyMap<string, Uint8Array>): number {
  let total = 0;
  for (const content of entries.values()) {
    total += content.byteLength;
  }
  return total;
}
