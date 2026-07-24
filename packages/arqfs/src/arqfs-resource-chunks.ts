import type { ArqfsDriver } from './arqfs-driver';

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

/**
 * ARQ-199: splits whole resource content into content-addressed chunks and stores
 * the resource descriptor plus every chunk in one transaction. Each chunk carries its
 * own sha256 (verified again on assembleResource, not just trusted) so a future
 * resumable upload (ARQ-208) can verify/dedupe per chunk, not only at the
 * whole-resource level.
 *
 * Idempotent by design, not by accident: storing content whose sha256 already
 * exists is a no-op (caught by a fuzz test - property-based testing generated the
 * same content twice across separate calls and hit a real UNIQUE constraint
 * failure before this check existed). Content-addressing's whole premise is that
 * identical bytes hash identically, so re-storing them is safe to skip rather than
 * treat as a conflict - a real caller re-uploading a shared texture must not fail.
 */
export async function putResource(
  driver: ArqfsDriver,
  content: Uint8Array,
  mediaType: string,
  canonicalRole: ArqfsResourceCanonicalRole,
  chunkSize: number,
): Promise<{ readonly sha256: string }> {
  const resourceSha256 = await sha256Hex(content);
  const chunks = splitIntoChunks(content, chunkSize);
  const chunkHashes = await Promise.all(chunks.map((chunk) => sha256Hex(chunk)));

  driver.transaction(() => {
    const existing = driver.query<{ readonly sha256: string }>(
      'SELECT sha256 FROM resource WHERE sha256 = ?',
      [resourceSha256],
    );
    if (existing.length > 0) {
      return;
    }

    driver.run(
      `INSERT INTO resource (sha256, media_type, canonical_role, byte_length, chunk_size, chunk_count)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [resourceSha256, mediaType, canonicalRole, content.length, chunkSize, chunks.length],
    );
    chunks.forEach((chunk, index) => {
      driver.run(
        `INSERT INTO resource_chunk (resource_sha256, chunk_index, chunk_sha256, content)
         VALUES (?, ?, ?, ?)`,
        [resourceSha256, index, chunkHashes[index], chunk],
      );
    });
  });

  return { sha256: resourceSha256 };
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
): Promise<AssembleResourceResult> {
  const descriptorRows = driver.query<{
    readonly byte_length: number;
    readonly chunk_count: number;
  }>('SELECT byte_length, chunk_count FROM resource WHERE sha256 = ?', [resourceSha256]);
  const descriptor = descriptorRows[0];
  if (!descriptor) {
    return { status: 'rejected', reason: 'unknown resource' };
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
    assembled.set(bytes, offset);
    offset += bytes.length;
  }

  if (offset !== descriptor.byte_length) {
    return {
      status: 'rejected',
      reason: `assembled length ${offset} does not match descriptor byte_length ${descriptor.byte_length}`,
    };
  }

  return { status: 'assembled', content: assembled };
}
