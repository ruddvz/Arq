import { describe, expect, it, afterEach } from 'vitest';
import { createHash } from 'node:crypto';
import { createNodeArqfsDriver } from './arqfs-node-driver';
import { createArqfsSchemaV1 } from './arqfs-schema';
import { putArchiveEntry } from './arqfs-archive-store';
import { SEMANTIC_HASH_SCHEME, computeProjectSemanticHash } from './arqfs-semantic-hash';
import type { ArqfsDriver } from './arqfs-driver';

/** Independent cross-check via node:crypto's synchronous API, not this module's own crypto.subtle call - proves the canonical byte layout, not just that SHA-256 agrees with itself. */
function independentReferenceHash(entries: ReadonlyMap<string, Uint8Array>): string {
  const hash = createHash('sha256');
  hash.update(Buffer.from(SEMANTIC_HASH_SCHEME, 'utf8'));
  for (const path of [...entries.keys()].sort()) {
    const pathBytes = Buffer.from(path, 'utf8');
    hash.update(lengthPrefix(pathBytes.length));
    hash.update(pathBytes);
    const content = entries.get(path)!;
    hash.update(lengthPrefix(content.length));
    hash.update(content);
  }
  return hash.digest('hex');
}

function lengthPrefix(length: number): Buffer {
  const bytes = Buffer.alloc(8);
  bytes.writeBigUInt64BE(BigInt(length), 0);
  return bytes;
}

describe('computeProjectSemanticHash', () => {
  let driver: ArqfsDriver;

  afterEach(() => {
    driver?.close();
  });

  function freshDriver(): ArqfsDriver {
    driver = createNodeArqfsDriver();
    createArqfsSchemaV1(driver);
    return driver;
  }

  it('an empty project (no archive entries) hashes to a fixed, known value', async () => {
    const d = freshDriver();
    // A test oracle: a hardcoded value a future accidental change to the
    // canonicalisation scheme must not silently alter. Computed via an
    // independent node:crypto call, not copied from this module's output.
    // Under v1 this was the digest of the empty string; the scheme tag is now
    // hashed first, so an empty project and "no scheme at all" cannot agree.
    expect(await computeProjectSemanticHash(d)).toBe(independentReferenceHash(new Map()));
    expect(await computeProjectSemanticHash(d)).toBe(
      createHash('sha256').update(Buffer.from(SEMANTIC_HASH_SCHEME, 'utf8')).digest('hex'),
    );
    expect(await computeProjectSemanticHash(d)).not.toBe(
      'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    );
  });

  it('matches an independent node:crypto computation for a realistic multi-entry project', async () => {
    const d = freshDriver();
    const entries = new Map<string, Uint8Array>([
      ['manifest.json', new TextEncoder().encode('{"projectId":"p1"}')],
      ['model.json', new TextEncoder().encode('{"walls":[{"id":"w1"}]}')],
      ['operations.ndjson', new TextEncoder().encode('{"kind":"CreateWall"}')],
    ]);
    for (const [path, content] of entries) {
      putArchiveEntry(d, path, content);
    }

    expect(await computeProjectSemanticHash(d)).toBe(independentReferenceHash(entries));
  });

  it('is deterministic regardless of insertion order (canonical ordering, not insertion order)', async () => {
    const a = freshDriver();
    putArchiveEntry(a, 'model.json', new TextEncoder().encode('{}'));
    putArchiveEntry(a, 'manifest.json', new TextEncoder().encode('{}'));
    const hashInsertedModelFirst = await computeProjectSemanticHash(a);
    a.close();

    driver = createNodeArqfsDriver();
    createArqfsSchemaV1(driver);
    putArchiveEntry(driver, 'manifest.json', new TextEncoder().encode('{}'));
    putArchiveEntry(driver, 'model.json', new TextEncoder().encode('{}'));
    const hashInsertedManifestFirst = await computeProjectSemanticHash(driver);

    expect(hashInsertedModelFirst).toBe(hashInsertedManifestFirst);
  });

  it('changes when any entry content changes, even by one byte', async () => {
    const d = freshDriver();
    putArchiveEntry(d, 'model.json', new TextEncoder().encode('{"a":1}'));
    const before = await computeProjectSemanticHash(d);

    putArchiveEntry(d, 'model.json', new TextEncoder().encode('{"a":2}'));
    const after = await computeProjectSemanticHash(d);

    expect(before).not.toBe(after);
  });

  it('a path and content split at the same byte offset under a naive separator scheme do not collide (length-prefixing, not NUL-separation)', async () => {
    const a = freshDriver();
    putArchiveEntry(a, 'ab', new TextEncoder().encode('c'));
    const hashSplitAsAbC = await computeProjectSemanticHash(a);
    a.close();

    driver = createNodeArqfsDriver();
    createArqfsSchemaV1(driver);
    putArchiveEntry(driver, 'a', new TextEncoder().encode('bc'));
    const hashSplitAsABc = await computeProjectSemanticHash(driver);

    expect(hashSplitAsAbC).not.toBe(hashSplitAsABc);
  });

  /**
   * The v1 defect. v1 length-prefixed the path and then concatenated content
   * raw, so an entry's content could contain the framing of the entry that
   * follows it, and a two-entry project became indistinguishable from a
   * one-entry project whose content was crafted to impersonate it.
   *
   * This matters because arqfs-migration-proof.test.ts asserts a migration
   * preserved meaning by comparing this digest before and after: a collision
   * here is a lossy migration that passes its own proof.
   */
  it('one entry cannot impersonate the framing of the entry that follows it', async () => {
    const payload = new TextEncoder().encode('PAYLOAD');

    const a = freshDriver();
    putArchiveEntry(a, 'a', new Uint8Array(0));
    putArchiveEntry(a, 'b', payload);
    const twoEntries = await computeProjectSemanticHash(a);
    a.close();

    // Exactly the bytes v1 would have emitted for the second entry: a 4-byte
    // big-endian path length, the path, then the content.
    const forged = new Uint8Array([0, 0, 0, 1, 'b'.charCodeAt(0), ...payload]);
    driver = createNodeArqfsDriver();
    createArqfsSchemaV1(driver);
    putArchiveEntry(driver, 'a', forged);
    const oneCraftedEntry = await computeProjectSemanticHash(driver);

    expect(twoEntries).not.toBe(oneCraftedEntry);
  });

  it('distinguishes an empty entry from an absent one', async () => {
    const a = freshDriver();
    putArchiveEntry(a, 'kept', new TextEncoder().encode('x'));
    putArchiveEntry(a, 'empty', new Uint8Array(0));
    const withEmptyEntry = await computeProjectSemanticHash(a);
    a.close();

    driver = createNodeArqfsDriver();
    createArqfsSchemaV1(driver);
    putArchiveEntry(driver, 'kept', new TextEncoder().encode('x'));
    const withoutEmptyEntry = await computeProjectSemanticHash(driver);

    expect(withEmptyEntry).not.toBe(withoutEmptyEntry);
  });
});
