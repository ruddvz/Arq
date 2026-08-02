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
 * The scheme identifier, hashed first.
 *
 * Two projects hashed under different schemes must never compare equal, and a
 * bare hex digest carries no way to tell which scheme produced it. Mixing the
 * tag into the digest input makes v1 and v2 outputs disjoint by construction.
 */
export const SEMANTIC_HASH_SCHEME = 'arq.semantic-hash.v2';

/** A 64-bit big-endian length, so a length prefix can never itself be forged out of content bytes. */
function lengthPrefix64(length: number): Uint8Array {
  const bytes = new Uint8Array(8);
  new DataView(bytes.buffer).setBigUint64(0, BigInt(length), false);
  return bytes;
}

/**
 * ARQ-200/222: the project's canonical semantic hash - SHA-256 over a scheme tag
 * followed by every archive entry's path and content, in canonical order.
 *
 * `listArchiveEntryPaths` returns paths sorted (`ORDER BY path` in SQL, byte-wise
 * ascending), which is `rust/arq-core`'s `canonical_sort_ids` rule applied at the
 * SQL layer - deterministic regardless of insertion order, matching
 * `docs/architecture/SHARED-RUST-CORE.md`'s "same operation, same hash, every
 * target."
 *
 * **Both** the path and the content are length-prefixed. v1 prefixed only the
 * path, and its own comment claimed that was sufficient. It was not, and the
 * counter-example is one entry absorbing the next entry's framing:
 *
 *   project A: {'a': <empty>, 'b': PAYLOAD}
 *   project B: {'a': <the bytes 00 00 00 01 'b' PAYLOAD>}
 *
 * Under v1 both serialise to `00 00 00 01 'a' 00 00 00 01 'b' PAYLOAD` and digest
 * identically, so two structurally different projects were indistinguishable. That
 * mattered beyond theory: this digest is what `arqfs-migration-proof.test.ts` uses
 * to assert a migration preserved meaning, so a crafted entry could make a lossy
 * migration look identity-preserving. Prefixing the content closes it, because the
 * reader of the byte stream can no longer be made to disagree with the writer about
 * where an entry ends.
 *
 * Changing the scheme cost nothing: no digest is persisted in any schema, any
 * file or any manifest, so there was nothing to re-hash or migrate.
 */
export async function computeProjectSemanticHash(driver: ArqfsDriver): Promise<string> {
  const paths = listArchiveEntryPaths(driver);
  const encoder = new TextEncoder();
  const parts: Uint8Array[] = [encoder.encode(SEMANTIC_HASH_SCHEME)];

  for (const path of paths) {
    const content = getArchiveEntry(driver, path);
    if (content === null) {
      continue;
    }
    const pathBytes = encoder.encode(path);
    parts.push(lengthPrefix64(pathBytes.length), pathBytes);
    parts.push(lengthPrefix64(content.length), content);
  }
  return sha256Hex(concatUint8Arrays(parts));
}
