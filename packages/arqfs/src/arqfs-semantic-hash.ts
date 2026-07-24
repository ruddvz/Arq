import type { ArqfsDriver } from './arqfs-driver';
import { listArchiveEntryPaths, getArchiveEntry } from './arqfs-archive-store';

async function sha256Hex(content: Uint8Array): Promise<string> {
  // Same BufferSource cast @arq/project-format/src/checksum.ts and
  // arqfs-resource-chunks.ts already document: a real Uint8Array is always a valid
  // digest input at runtime.
  const digest = await crypto.subtle.digest('SHA-256', content as BufferSource);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

function concatUint8Arrays(parts: readonly Uint8Array[]): Uint8Array {
  const totalLength = parts.reduce((sum, part) => sum + part.length, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;
  for (const part of parts) {
    result.set(part, offset);
    offset += part.length;
  }
  return result;
}

/**
 * ARQ-200/222: the project's canonical semantic hash - SHA-256 over every archive
 * entry's path and content, concatenated in canonical order.
 * `listArchiveEntryPaths` already returns paths sorted (`ORDER BY path` in SQL,
 * byte-wise ascending), which is exactly `rust/arq-core`'s `canonical_sort_ids` rule
 * applied at the SQL layer - deterministic regardless of insertion order, matching
 * `docs/architecture/SHARED-RUST-CORE.md`'s "same operation, same hash, every
 * target." Each entry is length-prefixed (a 4-byte big-endian path length before the
 * path bytes) rather than NUL-separated, so a path or content that happens to
 * contain a NUL byte cannot be crafted to collide with a different path/content
 * split at the same overall byte offset.
 */
export async function computeProjectSemanticHash(driver: ArqfsDriver): Promise<string> {
  const paths = listArchiveEntryPaths(driver);
  const parts: Uint8Array[] = [];
  for (const path of paths) {
    const content = getArchiveEntry(driver, path);
    if (content === null) {
      continue;
    }
    const pathBytes = new TextEncoder().encode(path);
    const pathLengthPrefix = new Uint8Array(4);
    new DataView(pathLengthPrefix.buffer).setUint32(0, pathBytes.length, false);
    parts.push(pathLengthPrefix, pathBytes, content);
  }
  return sha256Hex(concatUint8Arrays(parts));
}
