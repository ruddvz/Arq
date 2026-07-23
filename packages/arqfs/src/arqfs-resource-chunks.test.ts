import { describe, expect, it, afterEach } from 'vitest';
import { createNodeArqfsDriver } from './arqfs-node-driver';
import { createArqfsSchemaV1 } from './arqfs-schema';
import { putResource, getResourceChunk, assembleResource } from './arqfs-resource-chunks';
import type { ArqfsDriver } from './arqfs-driver';

describe('arqfs-resource-chunks', () => {
  let driver: ArqfsDriver;

  afterEach(() => {
    driver?.close();
  });

  function freshDriver(): ArqfsDriver {
    driver = createNodeArqfsDriver();
    createArqfsSchemaV1(driver);
    return driver;
  }

  it('splits content across multiple chunks and reassembles it byte-for-byte', async () => {
    const d = freshDriver();
    const content = new Uint8Array(250);
    for (let i = 0; i < content.length; i++) content[i] = i % 256;

    const { sha256 } = await putResource(
      d,
      content,
      'application/octet-stream',
      'user-texture',
      100,
    );

    const descriptorRows = d.query<{ chunk_count: number; byte_length: number }>(
      'SELECT chunk_count, byte_length FROM resource WHERE sha256 = ?',
      [sha256],
    );
    expect(descriptorRows[0]).toEqual({ chunk_count: 3, byte_length: 250 });

    const result = await assembleResource(d, sha256);
    expect(result.status).toBe('assembled');
    expect(result.status === 'assembled' && result.content).toEqual(content);
  });

  it('a resource smaller than the chunk size gets exactly one chunk', async () => {
    const d = freshDriver();
    const content = new TextEncoder().encode('small');

    const { sha256 } = await putResource(d, content, 'text/plain', 'portable-preview', 1_000_000);

    expect(getResourceChunk(d, sha256, 0)).toEqual(content);
    expect(getResourceChunk(d, sha256, 1)).toBeNull();
  });

  it('a zero-length resource gets exactly one empty chunk, not zero chunks', async () => {
    const d = freshDriver();
    const { sha256 } = await putResource(
      d,
      new Uint8Array(0),
      'application/octet-stream',
      'user-texture',
      100,
    );

    const result = await assembleResource(d, sha256);
    expect(result).toEqual({ status: 'assembled', content: new Uint8Array(0) });
  });

  it('rejects assembling an unknown resource rather than throwing', async () => {
    const d = freshDriver();
    const result = await assembleResource(d, 'nonexistent-sha256');
    expect(result).toEqual({ status: 'rejected', reason: 'unknown resource' });
  });

  it('rejects a resource with a missing chunk row', async () => {
    const d = freshDriver();
    const content = new Uint8Array(250);
    const { sha256 } = await putResource(
      d,
      content,
      'application/octet-stream',
      'user-texture',
      100,
    );

    d.run('DELETE FROM resource_chunk WHERE resource_sha256 = ? AND chunk_index = 1', [sha256]);

    const result = await assembleResource(d, sha256);
    expect(result.status).toBe('rejected');
  });

  it('rejects a resource whose chunk content was tampered with after storage (hash mismatch)', async () => {
    const d = freshDriver();
    const content = new TextEncoder().encode('original content here');
    const { sha256 } = await putResource(d, content, 'text/plain', 'user-texture', 1000);

    d.run('UPDATE resource_chunk SET content = ? WHERE resource_sha256 = ? AND chunk_index = 0', [
      new TextEncoder().encode('tampered!!!!!!!!!!!!!!'),
      sha256,
    ]);

    const result = await assembleResource(d, sha256);
    expect(result).toEqual({
      status: 'rejected',
      reason: expect.stringContaining('integrity check'),
    });
  });
});
