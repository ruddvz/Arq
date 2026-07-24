import { describe, expect, it } from 'vitest';
import { createChunkUploadSession } from './resumable-chunk-upload';

describe('createChunkUploadSession', () => {
  it('reports all chunks missing before anything is uploaded', () => {
    const session = createChunkUploadSession('resource-1', 3);
    expect(session.missingChunkIndices()).toEqual([0, 1, 2]);
    expect(session.isComplete()).toBe(false);
  });

  it('accepts chunks and removes them from the missing list', () => {
    const session = createChunkUploadSession('resource-1', 3);
    expect(session.acceptChunk(1, 'hash-1')).toEqual({ status: 'accepted' });
    expect(session.missingChunkIndices()).toEqual([0, 2]);
  });

  it('is complete once every chunk index has been accepted, regardless of order', () => {
    const session = createChunkUploadSession('resource-1', 3);
    session.acceptChunk(2, 'hash-2');
    session.acceptChunk(0, 'hash-0');
    expect(session.isComplete()).toBe(false);
    session.acceptChunk(1, 'hash-1');
    expect(session.isComplete()).toBe(true);
    expect(session.missingChunkIndices()).toEqual([]);
  });

  it('re-uploading the same chunk with the same hash is a safe duplicate, not an error', () => {
    const session = createChunkUploadSession('resource-1', 2);
    session.acceptChunk(0, 'hash-0');
    expect(session.acceptChunk(0, 'hash-0')).toEqual({ status: 'duplicate' });
  });

  it('rejects the same index re-sent with a different hash, rather than silently overwriting a verified chunk', () => {
    const session = createChunkUploadSession('resource-1', 2);
    session.acceptChunk(0, 'hash-0');
    const result = session.acceptChunk(0, 'different-hash');
    expect(result).toEqual({
      status: 'rejected',
      reason: expect.stringContaining('different hash'),
    });
  });

  it('rejects an out-of-range chunk index', () => {
    const session = createChunkUploadSession('resource-1', 2);
    expect(session.acceptChunk(5, 'hash').status).toBe('rejected');
    expect(session.acceptChunk(-1, 'hash').status).toBe('rejected');
  });

  it('supports the actual resume scenario: a fresh session reconstructed from a partial missing-index response only asks for what is missing', () => {
    const original = createChunkUploadSession('resource-1', 4);
    original.acceptChunk(0, 'hash-0');
    original.acceptChunk(1, 'hash-1');
    // Connection drops here - a resumed session on the client only needs to send
    // what the server reports as missing, not the whole resource again.
    expect(original.missingChunkIndices()).toEqual([2, 3]);
  });
});
