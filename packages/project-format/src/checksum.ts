/**
 * ARQ-077: implement archive checksums.
 *
 * checksums.json's content: a SHA-256 hex digest per archive entry,
 * matching section 73's requirements ("checksums; deterministic
 * ordering where practical"). Uses the Web Crypto API (available in
 * both browsers and Node 19+) rather than a Node-only crypto module, so
 * this stays usable from a browser context too.
 *
 * verifyChecksums is what makes "corrupt optional data fails safely"
 * (ARQ-076's acceptance criterion) checkable: it reports mismatches by
 * path rather than throwing, so a caller can decide per-entry whether a
 * mismatch is fatal (manifest.json, model.json) or safely ignorable (an
 * optional thumbnail cache).
 */

async function sha256Hex(content: Uint8Array): Promise<string> {
  // Uint8Array's ArrayBufferLike-backed type doesn't structurally satisfy
  // BufferSource's ArrayBuffer-only constraint under recent TS lib.dom
  // typings, even though every real Uint8Array is a valid digest input at
  // runtime - a type-level false positive, not a real incompatibility.
  const digest = await crypto.subtle.digest('SHA-256', content as BufferSource);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

export interface ChecksumEntry {
  readonly path: string;
  readonly sha256: string;
}

/** Computes a checksum entry per archive path, sorted by path for deterministic output. */
export async function computeChecksums(
  entries: ReadonlyMap<string, Uint8Array>,
): Promise<readonly ChecksumEntry[]> {
  const results: ChecksumEntry[] = [];
  for (const [path, content] of entries) {
    results.push({ path, sha256: await sha256Hex(content) });
  }
  return results.sort((a, b) => a.path.localeCompare(b.path));
}

/** Returns the paths whose current content does not match the recorded checksum, or is missing entirely. Empty array means everything verified. */
export async function verifyChecksums(
  entries: ReadonlyMap<string, Uint8Array>,
  checksums: readonly ChecksumEntry[],
): Promise<readonly string[]> {
  const mismatches: string[] = [];
  for (const { path, sha256 } of checksums) {
    const content = entries.get(path);
    if (content === undefined) {
      mismatches.push(path);
      continue;
    }
    if ((await sha256Hex(content)) !== sha256) {
      mismatches.push(path);
    }
  }
  return mismatches;
}

export function serializeChecksums(checksums: readonly ChecksumEntry[]): string {
  return JSON.stringify(checksums, null, 2);
}

/** Parses checksums.json content; returns an empty array (never throws) on anything malformed - checksums.json is itself optional-cache-like data, so a corrupt copy must not prevent opening the archive. */
export function parseChecksums(content: string): readonly ChecksumEntry[] {
  let value: unknown;
  try {
    value = JSON.parse(content);
  } catch {
    return [];
  }
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter(
    (entry): entry is ChecksumEntry =>
      typeof entry === 'object' &&
      entry !== null &&
      typeof (entry as { path?: unknown }).path === 'string' &&
      typeof (entry as { sha256?: unknown }).sha256 === 'string',
  );
}
