import { canonicalJson, sha256Hex } from './canonical';
import type { CacheKeyInput } from './types';

export function buildCacheKeyMaterial(input: CacheKeyInput): string {
  if (!Number.isInteger(input.namespaceVersion) || input.namespaceVersion < 1)
    throw new Error('namespaceVersion must be a positive integer');
  if (!input.projectId || !input.semanticRevisionHash || !input.engineFingerprint || !input.scopeId)
    throw new Error('cache key fields must be non-empty');
  return canonicalJson(input);
}

export async function computeCacheKey(input: CacheKeyInput): Promise<string> {
  return sha256Hex(buildCacheKeyMaterial(input));
}
