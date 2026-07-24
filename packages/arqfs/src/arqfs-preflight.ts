/**
 * Byte-level pre-validation for a file claimed to be an .arq database, before ever
 * handing it to a SQLite driver constructor. Complements arqfs-defensive-open.ts's
 * `applyDefensiveOpenPolicy` (connection-level PRAGMA hardening once a driver is
 * already open) rather than duplicating it: this runs earlier, against raw bytes
 * only, so an oversized or malformed file can be rejected before a SQLite
 * connection is even attempted (e.g. a browser file picker handing this a
 * multi-gigabyte or truncated upload). Reads only the fixed 100-byte SQLite header
 * (magic string, page size, application ID, schema cookie) - see
 * https://www.sqlite.org/fileformat2.html#the_database_header.
 */
const SQLITE_SIGNATURE = new TextEncoder().encode('SQLite format 3\0');
const ARQ_APPLICATION_ID = 0x41525131;
const MINIMUM_SQLITE_HEADER_BYTES = 100;

export interface ArqfsPreflightPolicy {
  readonly maxFileBytes: number;
  readonly maxPageCount: number;
}

export const DEFAULT_ARQFS_PREFLIGHT_POLICY: ArqfsPreflightPolicy = {
  maxFileBytes: 8 * 1024 * 1024 * 1024,
  maxPageCount: 16_777_216,
};

export type ArqfsBytePreflightResult =
  | {
      readonly status: 'accepted';
      readonly pageSize: number;
      readonly estimatedPageCount: number;
      readonly applicationId: number;
      readonly schemaVersion: number;
    }
  | { readonly status: 'rejected'; readonly code: string; readonly reason: string };

function readU32BE(bytes: Uint8Array, offset: number): number {
  return (
    ((bytes[offset] ?? 0) * 0x1000000 +
      ((bytes[offset + 1] ?? 0) << 16) +
      ((bytes[offset + 2] ?? 0) << 8) +
      (bytes[offset + 3] ?? 0)) >>>
    0
  );
}

export function preflightArqfsBytes(
  bytes: Uint8Array,
  policy: ArqfsPreflightPolicy = DEFAULT_ARQFS_PREFLIGHT_POLICY,
): ArqfsBytePreflightResult {
  if (bytes.byteLength > policy.maxFileBytes) {
    return {
      status: 'rejected',
      code: 'ARQ_FILE_TOO_LARGE',
      reason: 'File exceeds configured size limit.',
    };
  }
  if (bytes.byteLength < MINIMUM_SQLITE_HEADER_BYTES) {
    return {
      status: 'rejected',
      code: 'ARQ_FILE_TRUNCATED',
      reason: 'File is shorter than a SQLite header.',
    };
  }
  for (let index = 0; index < SQLITE_SIGNATURE.length; index += 1) {
    if (bytes[index] !== SQLITE_SIGNATURE[index]) {
      return { status: 'rejected', code: 'ARQ_NOT_SQLITE', reason: 'SQLite signature is missing.' };
    }
  }
  const encodedPageSize = ((bytes[16] ?? 0) << 8) | (bytes[17] ?? 0);
  const pageSize = encodedPageSize === 1 ? 65_536 : encodedPageSize;
  if (pageSize < 512 || pageSize > 65_536 || (pageSize & (pageSize - 1)) !== 0) {
    return {
      status: 'rejected',
      code: 'ARQ_INVALID_PAGE_SIZE',
      reason: 'Invalid SQLite page size.',
    };
  }
  const applicationId = readU32BE(bytes, 68);
  if (applicationId !== ARQ_APPLICATION_ID) {
    return {
      status: 'rejected',
      code: 'ARQ_APPLICATION_ID_MISMATCH',
      reason: 'Not an Arq SQLite application file.',
    };
  }
  const schemaVersion = readU32BE(bytes, 60);
  const estimatedPageCount = Math.ceil(bytes.byteLength / pageSize);
  if (estimatedPageCount > policy.maxPageCount) {
    return {
      status: 'rejected',
      code: 'ARQ_PAGE_LIMIT_EXCEEDED',
      reason: 'File exceeds configured page-count limit.',
    };
  }
  return { status: 'accepted', pageSize, estimatedPageCount, applicationId, schemaVersion };
}
