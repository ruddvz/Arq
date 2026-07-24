import { MAX_ARCHIVE_TOTAL_BYTES, MAX_ENTRY_BYTES } from '@arq/project-format';

/**
 * Bounds applied at the SQLite row boundary. `@arq/project-format` applies the
 * same limits while decoding a portable archive; keeping the values here makes
 * a native `.arq` file no weaker just because it bypasses the zip container.
 */
export interface ArqfsStoragePolicy {
  readonly maxArchiveEntries: number;
  readonly maxArchiveEntryBytes: number;
  readonly maxArchiveTotalBytes: number;
  readonly maxArchivePathBytes: number;
  readonly maxResourceBytes: number;
  readonly maxResourceChunkBytes: number;
  readonly maxResourceChunks: number;
}

export const DEFAULT_ARQFS_STORAGE_POLICY: ArqfsStoragePolicy = {
  maxArchiveEntries: 100_000,
  maxArchiveEntryBytes: MAX_ENTRY_BYTES,
  maxArchiveTotalBytes: MAX_ARCHIVE_TOTAL_BYTES,
  maxArchivePathBytes: 1024,
  maxResourceBytes: MAX_ARCHIVE_TOTAL_BYTES,
  maxResourceChunkBytes: 8 * 1024 * 1024,
  maxResourceChunks: 1_000_000,
};

/**
 * Validates caller-supplied limits before they are used in a query or arithmetic
 * check. A policy is part of the trust boundary too: NaN, fractional or negative
 * limits can otherwise turn a protection into an accidental bypass.
 */
export function validateArqfsStoragePolicy(policy: ArqfsStoragePolicy): void {
  const positiveIntegerKeys: readonly (keyof ArqfsStoragePolicy)[] = [
    'maxArchiveEntries',
    'maxArchiveEntryBytes',
    'maxArchiveTotalBytes',
    'maxArchivePathBytes',
    'maxResourceBytes',
    'maxResourceChunkBytes',
    'maxResourceChunks',
  ];
  for (const key of positiveIntegerKeys) {
    const value = policy[key];
    if (!Number.isSafeInteger(value) || value < 1) {
      throw new ArqfsPolicyError(
        'ARQ_POLICY_INVALID',
        `Storage policy ${key} must be a positive integer.`,
      );
    }
  }
  if (policy.maxArchiveEntryBytes > policy.maxArchiveTotalBytes) {
    throw new ArqfsPolicyError(
      'ARQ_POLICY_INVALID',
      'Storage policy maxArchiveEntryBytes cannot exceed maxArchiveTotalBytes.',
    );
  }
  if (policy.maxResourceChunkBytes > policy.maxResourceBytes) {
    throw new ArqfsPolicyError(
      'ARQ_POLICY_INVALID',
      'Storage policy maxResourceChunkBytes cannot exceed maxResourceBytes.',
    );
  }
}

export type ArqfsPolicyCode =
  | 'ARQ_PATH_INVALID'
  | 'ARQ_PATH_TOO_LONG'
  | 'ARQ_ENTRY_TOO_LARGE'
  | 'ARQ_ARCHIVE_TOO_LARGE'
  | 'ARQ_TOO_MANY_ENTRIES'
  | 'ARQ_CHUNK_SIZE_INVALID'
  | 'ARQ_RESOURCE_TOO_LARGE'
  | 'ARQ_TOO_MANY_CHUNKS'
  | 'ARQ_RESOURCE_METADATA_CONFLICT'
  | 'ARQ_RESOURCE_METADATA_INVALID'
  | 'ARQ_POLICY_INVALID';

export class ArqfsPolicyError extends Error {
  readonly code: ArqfsPolicyCode;

  constructor(code: ArqfsPolicyCode, message: string) {
    super(message);
    this.name = 'ArqfsPolicyError';
    this.code = code;
  }
}

const DRIVE_PATH = /^[A-Za-z]:/;

/**
 * Archive paths are logical POSIX paths, never host paths. Rejecting empty,
 * dot and parent segments prevents aliases that could bypass limits or make
 * semantic hashes disagree between platforms. NUL and control characters are
 * rejected because they are unsafe in diagnostics and native file bridges.
 */
export function validateArqfsArchivePath(
  path: string,
  policy: ArqfsStoragePolicy = DEFAULT_ARQFS_STORAGE_POLICY,
): void {
  validateArqfsStoragePolicy(policy);
  const encodedLength = new TextEncoder().encode(path).byteLength;
  if (encodedLength > policy.maxArchivePathBytes) {
    throw new ArqfsPolicyError('ARQ_PATH_TOO_LONG', 'Archive path exceeds the configured limit.');
  }
  if (
    path.length === 0 ||
    path.startsWith('/') ||
    path.includes('\\') ||
    DRIVE_PATH.test(path) ||
    path.includes('\0') ||
    [...path].some((character) => character < ' ')
  ) {
    throw new ArqfsPolicyError('ARQ_PATH_INVALID', 'Archive path is not a safe logical path.');
  }
  const segments = path.split('/');
  if (segments.some((segment) => segment.length === 0 || segment === '.' || segment === '..')) {
    throw new ArqfsPolicyError('ARQ_PATH_INVALID', 'Archive path contains an invalid segment.');
  }
}

export function validateArchiveEntryBytes(
  path: string,
  content: Uint8Array,
  policy: ArqfsStoragePolicy = DEFAULT_ARQFS_STORAGE_POLICY,
): void {
  validateArqfsArchivePath(path, policy);
  validateArchiveEntryLength(content.byteLength, policy);
}

export function validateArchiveEntryLength(
  byteLength: number,
  policy: ArqfsStoragePolicy = DEFAULT_ARQFS_STORAGE_POLICY,
): void {
  validateArqfsStoragePolicy(policy);
  if (
    !Number.isSafeInteger(byteLength) ||
    byteLength < 0 ||
    byteLength > policy.maxArchiveEntryBytes
  ) {
    throw new ArqfsPolicyError(
      'ARQ_ENTRY_TOO_LARGE',
      'Archive entry exceeds the configured limit.',
    );
  }
}

export function validateChunkSize(
  chunkSize: number,
  policy: ArqfsStoragePolicy = DEFAULT_ARQFS_STORAGE_POLICY,
): void {
  validateArqfsStoragePolicy(policy);
  if (
    !Number.isSafeInteger(chunkSize) ||
    chunkSize < 1 ||
    chunkSize > policy.maxResourceChunkBytes
  ) {
    throw new ArqfsPolicyError(
      'ARQ_CHUNK_SIZE_INVALID',
      'Resource chunk size is outside the configured limit.',
    );
  }
}

export function validateResourceShape(
  byteLength: number,
  chunkSize: number,
  chunkCount: number,
  policy: ArqfsStoragePolicy = DEFAULT_ARQFS_STORAGE_POLICY,
): void {
  validateArqfsStoragePolicy(policy);
  validateChunkSize(chunkSize, policy);
  if (!Number.isSafeInteger(byteLength) || byteLength < 0 || byteLength > policy.maxResourceBytes) {
    throw new ArqfsPolicyError(
      'ARQ_RESOURCE_TOO_LARGE',
      'Resource exceeds the configured byte limit.',
    );
  }
  if (
    !Number.isSafeInteger(chunkCount) ||
    chunkCount < 1 ||
    chunkCount > policy.maxResourceChunks
  ) {
    throw new ArqfsPolicyError('ARQ_TOO_MANY_CHUNKS', 'Resource has too many chunks.');
  }
  const expectedChunkCount = Math.max(1, Math.ceil(byteLength / chunkSize));
  if (chunkCount !== expectedChunkCount) {
    throw new ArqfsPolicyError(
      'ARQ_TOO_MANY_CHUNKS',
      'Resource chunk count does not match its byte length.',
    );
  }
}

export function validateResourceMetadata(
  mediaType: string,
  canonicalRole: string,
  policy: ArqfsStoragePolicy = DEFAULT_ARQFS_STORAGE_POLICY,
): void {
  validateArqfsStoragePolicy(policy);
  const allowedRoles = new Set([
    'source-underlay',
    'source-import',
    'authoritative-geometry',
    'user-texture',
    'portable-preview',
  ]);
  const mediaTypeBytes = new TextEncoder().encode(mediaType).byteLength;
  if (
    mediaType.length === 0 ||
    mediaTypeBytes > 255 ||
    [...mediaType].some((character) => character < ' ' || character === '\u007f') ||
    !allowedRoles.has(canonicalRole)
  ) {
    throw new ArqfsPolicyError(
      'ARQ_RESOURCE_METADATA_INVALID',
      'Resource media type or canonical role is invalid.',
    );
  }
}

export function validateArchiveTotals(
  entryCount: number,
  totalBytes: number,
  policy: ArqfsStoragePolicy = DEFAULT_ARQFS_STORAGE_POLICY,
): void {
  validateArqfsStoragePolicy(policy);
  if (
    !Number.isSafeInteger(entryCount) ||
    entryCount < 0 ||
    !Number.isSafeInteger(totalBytes) ||
    totalBytes < 0
  ) {
    throw new ArqfsPolicyError(
      'ARQ_POLICY_INVALID',
      'Archive totals must be non-negative safe integers.',
    );
  }
  if (entryCount > policy.maxArchiveEntries) {
    throw new ArqfsPolicyError(
      'ARQ_TOO_MANY_ENTRIES',
      'The project contains too many archive entries.',
    );
  }
  if (totalBytes > policy.maxArchiveTotalBytes) {
    throw new ArqfsPolicyError(
      'ARQ_ARCHIVE_TOO_LARGE',
      'The project exceeds the configured archive size limit.',
    );
  }
}
