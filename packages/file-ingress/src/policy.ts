import type { ImportPolicy, SerializableImportPolicy } from './types';

export const DEFAULT_IMPORT_POLICY: ImportPolicy = {
  maxSourceBytes: 500 * 1024 * 1024,
  maxStagedElements: 1_000_000,
  maxTextCodePoints: 10_000_000,
  allowNetworkBridge: false,
  allowAttachmentFallback: true,
  preserveOriginalSource: true,
};

export function serialiseImportPolicy(policy: ImportPolicy): SerializableImportPolicy {
  return { ...policy };
}

export function deserialiseImportPolicy(policy: SerializableImportPolicy): ImportPolicy {
  if (!Number.isSafeInteger(policy.maxSourceBytes) || policy.maxSourceBytes <= 0) {
    throw new Error('Invalid maxSourceBytes');
  }
  if (!Number.isSafeInteger(policy.maxStagedElements) || policy.maxStagedElements <= 0) {
    throw new Error('Invalid maxStagedElements');
  }
  if (!Number.isSafeInteger(policy.maxTextCodePoints) || policy.maxTextCodePoints <= 0) {
    throw new Error('Invalid maxTextCodePoints');
  }
  return { ...policy };
}
