import { describe, expect, it, afterEach } from 'vitest';
import { createHash } from 'node:crypto';
import { createNodeArqfsDriver } from './arqfs-node-driver';
import { createArqfsSchemaV1 } from './arqfs-schema';
import { putArchiveEntry } from './arqfs-archive-store';
import { computeProjectSemanticHash } from './arqfs-semantic-hash';
import type { ArqfsDriver } from './arqfs-driver';

/** Independent cross-check via node:crypto's synchronous API, not this module's own crypto.subtle call - proves the canonical byte layout, not just that SHA-256 agrees with itself. */
function independentReferenceHash(entries: ReadonlyMap<string, Uint8Array>): string {
  const hash = createHash('sha256');
  for (const path of [...entries.keys()].sort()) {
    const pathBytes = Buffer.from(path, 'utf8');
    const lengthPrefix = Buffer.alloc(4);
    lengthPrefix.writeUInt32BE(pathBytes.length, 0);
    hash.update(lengthPrefix);
    hash.update(pathBytes);
    hash.update(entries.get(path)!);
  }
  return hash.digest('hex');
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
    // This is a test oracle: a hardcoded expected value a future accidental change
    // to the canonicalisation/hashing scheme must not silently alter. Computed via
    // an independent node:crypto call, not copied from this module's own output.
    expect(await computeProjectSemanticHash(d)).toBe(independentReferenceHash(new Map()));
    expect(await computeProjectSemanticHash(d)).toBe(
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
});
