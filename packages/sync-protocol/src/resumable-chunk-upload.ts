/**
 * ARQ-208: resumable resource chunk upload. Builds on @arq/arqfs's
 * content-addressed chunks (ARQ-199) - each chunk already carries its own sha256,
 * which is exactly what a real resumable-upload negotiation needs: a client
 * interrupted partway through can ask "which chunks do you already have?" and send
 * only what is missing, rather than the whole resource again. Pure reference model,
 * no real network transport - apps/api is still a stub.
 */
export type AcceptChunkResult =
  | { readonly status: 'accepted' }
  | { readonly status: 'duplicate' }
  | { readonly status: 'rejected'; readonly reason: string };

export interface ChunkUploadSession {
  readonly resourceSha256: string;
  readonly totalChunks: number;
  /** A chunk already received with the same hash is a 'duplicate' (safe retry, e.g. after a dropped ack). The same index received with a DIFFERENT hash is rejected outright rather than silently overwritten - corrupt or mismatched data must not replace a verified chunk. */
  acceptChunk(chunkIndex: number, chunkSha256: string): AcceptChunkResult;
  /** What a resuming client should send next - every index not yet accepted. */
  missingChunkIndices(): readonly number[];
  isComplete(): boolean;
}

export function createChunkUploadSession(
  resourceSha256: string,
  totalChunks: number,
): ChunkUploadSession {
  const receivedHashesByIndex = new Map<number, string>();

  return {
    resourceSha256,
    totalChunks,
    acceptChunk(chunkIndex: number, chunkSha256: string): AcceptChunkResult {
      if (!Number.isInteger(chunkIndex) || chunkIndex < 0 || chunkIndex >= totalChunks) {
        return {
          status: 'rejected',
          reason: `chunk index ${chunkIndex} out of range [0, ${totalChunks})`,
        };
      }
      const existing = receivedHashesByIndex.get(chunkIndex);
      if (existing !== undefined) {
        if (existing !== chunkSha256) {
          return {
            status: 'rejected',
            reason: `chunk ${chunkIndex} was already received with a different hash`,
          };
        }
        return { status: 'duplicate' };
      }
      receivedHashesByIndex.set(chunkIndex, chunkSha256);
      return { status: 'accepted' };
    },
    missingChunkIndices(): readonly number[] {
      const missing: number[] = [];
      for (let index = 0; index < totalChunks; index++) {
        if (!receivedHashesByIndex.has(index)) {
          missing.push(index);
        }
      }
      return missing;
    },
    isComplete(): boolean {
      return receivedHashesByIndex.size === totalChunks;
    },
  };
}
