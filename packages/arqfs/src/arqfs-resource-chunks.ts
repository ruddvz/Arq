import type { ArqfsDriver } from './arqfs-driver';
import {
  ArqfsPolicyError,
  DEFAULT_ARQFS_STORAGE_POLICY,
  validateResourceMetadata,
  validateResourceShape,
  type ArqfsStoragePolicy,
} from './arqfs-policy';

/** Matches contracts/arqfs.ts's ArqResourceDescriptor.canonicalRole (reference-only; reproduced, not imported - see arqfs-header.ts). */
export type ArqfsResourceCanonicalRole =
  | 'source-underlay'
  | 'source-import'
  | 'authoritative-geometry'
  | 'user-texture'
  | 'portable-preview';

async function sha256Hex(content: Uint8Array): Promise<string> {
  // Same BufferSource type-level cast @arq/project-format/src/checksum.ts already
  // documents: a real Uint8Array is always a valid digest input at runtime.
  const digest = await crypto.subtle.digest('SHA-256', content as BufferSource);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

function splitIntoChunks(content: Uint8Array, chunkSize: number): Uint8Array[] {
  const chunks: Uint8Array[] = [];
  for (let offset = 0; offset < content.length; offset += chunkSize) {
    chunks.push(content.subarray(offset, offset + chunkSize));
  }
  // A zero-length resource still gets exactly one (empty) chunk, so chunk_count is
  // never zero and assembleResource's "expected N chunks" check has something to
  // check against.
  return chunks.length > 0 ? chunks : [new Uint8Array(0)];
}

export interface ArqfsResourceContentDescriptor {
  readonly sha256: string;
  readonly byteLength: number;
  readonly chunkSize: number;
  readonly chunks: readonly Uint8Array[];
  readonly chunkHashes: readonly string[];
}

/**
 * The async half of storing a resource - hashing the whole content and every
 * chunk - with no driver access at all, so it can run before a caller opens any
 * transaction. Split out from `putResource` so a caller that needs to store a
 * resource as one step of a larger atomic write (e.g. `arqfs-import-commit.ts`
 * committing a source document alongside its preserved bytes) can compute this
 * first, then fold the now-synchronous `putResourceDescriptor` into its own
 * `driver.transaction()` alongside its other writes - `runArqfsLocalWrite`'s
 * mutation callback is synchronous by design (see `arqfs-driver.ts`) and cannot
 * itself await a hash. `chunkSize` is carried through as the caller's original
 * splitting parameter, not re-derived from a chunk's own byte length - the last
 * chunk (or the only chunk, for content smaller than one chunk) is legitimately
 * shorter than `chunkSize`, so reconstructing it from `chunks[0].byteLength` would
 * silently record the wrong value for exactly that case.
 */
export async function computeResourceContentDescriptor(
  content: Uint8Array,
  chunkSize: number,
): Promise<ArqfsResourceContentDescriptor> {
  const resourceSha256 = await sha256Hex(content);
  const chunks = splitIntoChunks(content, chunkSize);
  const chunkHashes = await Promise.all(chunks.map((chunk) => sha256Hex(chunk)));
  return { sha256: resourceSha256, byteLength: content.byteLength, chunkSize, chunks, chunkHashes };
}

/**
 * The synchronous half: writes an already-hashed descriptor's resource/chunk rows.
 * Does not open its own transaction - call it from inside a caller's transaction
 * (as `putResource` below does) so it composes atomically with a caller's other
 * writes rather than always being its own commit boundary.
 *
 * Idempotent by design, not by accident: storing content whose sha256 already
 * exists is a no-op (caught by a fuzz test - property-based testing generated the
 * same content twice across separate calls and hit a real UNIQUE constraint
 * failure before this check existed). Content-addressing's whole premise is that
 * identical bytes hash identically, so re-storing them is safe to skip rather than
 * treat as a conflict - a real caller re-uploading a shared texture must not fail.
 */
export function putResourceDescriptor(
  driver: ArqfsDriver,
  descriptor: ArqfsResourceContentDescriptor,
  mediaType: string,
  canonicalRole: ArqfsResourceCanonicalRole,
  policy: ArqfsStoragePolicy = DEFAULT_ARQFS_STORAGE_POLICY,
): { readonly sha256: string } {
  const { sha256: resourceSha256, byteLength, chunkSize, chunks, chunkHashes } = descriptor;
  validateResourceMetadata(mediaType, canonicalRole, policy);
  validateResourceShape(byteLength, chunkSize, chunks.length, policy);

  const existing = driver.query<{
    readonly sha256: string;
    readonly media_type: string;
    readonly canonical_role: ArqfsResourceCanonicalRole;
    readonly byte_length: number;
    readonly chunk_size: number;
    readonly chunk_count: number;
  }>(
    'SELECT sha256, media_type, canonical_role, byte_length, chunk_size, chunk_count FROM resource WHERE sha256 = ?',
    [resourceSha256],
  );
  const existingDescriptor = existing[0];
  if (existingDescriptor !== undefined) {
    // Only fields that content addressing does NOT already determine can conflict.
    // `media_type` and `canonical_role` are caller-supplied semantics, so a
    // mismatch is a genuine poisoning signal; `byte_length` must follow from the
    // bytes, so a mismatch means the stored descriptor is corrupt. `chunk_size`
    // and `chunk_count` are physical layout of the copy already on disk - storing
    // identical bytes under a different chunking policy is legitimate dedupe and
    // must not be rejected, because the stored chunks are already self-consistent.
    if (
      existingDescriptor.media_type !== mediaType ||
      existingDescriptor.canonical_role !== canonicalRole ||
      existingDescriptor.byte_length !== byteLength
    ) {
      throw new ArqfsPolicyError(
        'ARQ_RESOURCE_METADATA_CONFLICT',
        'Content-addressed resource already exists with different metadata.',
      );
    }
    return { sha256: resourceSha256 };
  }

  driver.run(
    `INSERT INTO resource (sha256, media_type, canonical_role, byte_length, chunk_size, chunk_count)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [resourceSha256, mediaType, canonicalRole, byteLength, chunkSize, chunks.length],
  );
  chunks.forEach((chunk, index) => {
    driver.run(
      `INSERT INTO resource_chunk (resource_sha256, chunk_index, chunk_sha256, content)
       VALUES (?, ?, ?, ?)`,
      [resourceSha256, index, chunkHashes[index], chunk],
    );
  });

  return { sha256: resourceSha256 };
}

/**
 * ARQ-199: splits whole resource content into content-addressed chunks and stores
 * the resource descriptor plus every chunk in one transaction. Each chunk carries its
 * own sha256 (verified again on assembleResource, not just trusted) so a future
 * resumable upload (ARQ-208) can verify/dedupe per chunk, not only at the
 * whole-resource level.
 */
export async function putResource(
  driver: ArqfsDriver,
  content: Uint8Array,
  mediaType: string,
  canonicalRole: ArqfsResourceCanonicalRole,
  chunkSize: number,
  policy: ArqfsStoragePolicy = DEFAULT_ARQFS_STORAGE_POLICY,
): Promise<{ readonly sha256: string }> {
  validateResourceMetadata(mediaType, canonicalRole, policy);
  validateResourceShape(
    content.byteLength,
    chunkSize,
    Math.max(1, Math.ceil(content.byteLength / chunkSize)),
    policy,
  );
  const descriptor = await computeResourceContentDescriptor(content, chunkSize);
  return driver.transaction(() =>
    putResourceDescriptor(driver, descriptor, mediaType, canonicalRole, policy),
  );
}

export function getResourceChunk(
  driver: ArqfsDriver,
  resourceSha256: string,
  chunkIndex: number,
): Uint8Array | null {
  const rows = driver.query<{ readonly content: Uint8Array }>(
    'SELECT content FROM resource_chunk WHERE resource_sha256 = ? AND chunk_index = ?',
    [resourceSha256, chunkIndex],
  );
  const row = rows[0];
  return row ? new Uint8Array(row.content) : null;
}

export type AssembleResourceResult =
  | { readonly status: 'assembled'; readonly content: Uint8Array }
  | { readonly status: 'rejected'; readonly reason: string };

/**
 * Reassembles a resource's chunks in order, verifying every chunk's sha256 against
 * what was recorded when it was stored (not merely trusted), plus contiguous
 * chunk_index coverage and total byte length against the resource descriptor. Never
 * throws - any inconsistency (missing chunk, corrupt chunk, length mismatch) is a
 * 'rejected' result.
 */
export async function assembleResource(
  driver: ArqfsDriver,
  resourceSha256: string,
  policy: ArqfsStoragePolicy = DEFAULT_ARQFS_STORAGE_POLICY,
): Promise<AssembleResourceResult> {
  const descriptorRows = driver.query<{
    readonly byte_length: number;
    readonly chunk_count: number;
    readonly chunk_size: number;
  }>('SELECT byte_length, chunk_count, chunk_size FROM resource WHERE sha256 = ?', [
    resourceSha256,
  ]);
  const descriptor = descriptorRows[0];
  if (!descriptor) {
    return { status: 'rejected', reason: 'unknown resource' };
  }
  try {
    validateResourceShape(
      descriptor.byte_length,
      descriptor.chunk_size,
      descriptor.chunk_count,
      policy,
    );
  } catch (error) {
    return {
      status: 'rejected',
      reason: error instanceof Error ? error.message : String(error),
    };
  }

  const chunkRows = driver.query<{
    readonly chunk_index: number;
    readonly content: Uint8Array;
    readonly chunk_sha256: string;
  }>(
    'SELECT chunk_index, content, chunk_sha256 FROM resource_chunk WHERE resource_sha256 = ? ORDER BY chunk_index',
    [resourceSha256],
  );
  if (chunkRows.length !== descriptor.chunk_count) {
    return {
      status: 'rejected',
      reason: `expected ${descriptor.chunk_count} chunks, found ${chunkRows.length}`,
    };
  }

  const assembled = new Uint8Array(descriptor.byte_length);
  let offset = 0;
  for (let index = 0; index < chunkRows.length; index++) {
    const row = chunkRows[index];
    if (!row || row.chunk_index !== index) {
      return { status: 'rejected', reason: `missing chunk at index ${index}` };
    }
    const bytes = new Uint8Array(row.content);
    if ((await sha256Hex(bytes)) !== row.chunk_sha256) {
      return { status: 'rejected', reason: `chunk ${index} failed integrity check` };
    }
    const expectedLength =
      index === descriptor.chunk_count - 1
        ? descriptor.byte_length - descriptor.chunk_size * (descriptor.chunk_count - 1)
        : descriptor.chunk_size;
    if (bytes.byteLength !== expectedLength) {
      return { status: 'rejected', reason: `chunk ${index} length does not match descriptor` };
    }
    assembled.set(bytes, offset);
    offset += bytes.length;
  }

  if (offset !== descriptor.byte_length) {
    return {
      status: 'rejected',
      reason: `assembled length ${offset} does not match descriptor byte_length ${descriptor.byte_length}`,
    };
  }

  if ((await sha256Hex(assembled)) !== resourceSha256) {
    return {
      status: 'rejected',
      reason: 'assembled resource failed whole-resource integrity check',
    };
  }

  return { status: 'assembled', content: assembled };
}
