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

/**
 * How the file records transactions, read from the header's file-format write
 * and read versions (offsets 18 and 19). SQLite writes 1 for a rollback journal
 * and 2 for a write-ahead log.
 */
export type ArqfsJournalMode = 'rollback-journal' | 'write-ahead-log';

/**
 * Whether these bytes are the whole database.
 *
 * A rollback-journal database is complete in one file. A write-ahead-log
 * database is not: every transaction committed since the last checkpoint lives
 * in a `-wal` sidecar next to it. SQLite opened against the main file with that
 * sidecar missing does not fail - it reads as though the log were empty and
 * returns the database as of the last checkpoint.
 *
 * That silence is reachable from Arq's own open path. A browser file picker
 * hands over exactly one file, so a user who picks `project.arq` can be shown a
 * compatible, accepted, apparently healthy project that is missing their most
 * recent saved work, with nothing anywhere reporting a problem. Preflight
 * cannot repair it - the missing bytes were never handed over - so it reports
 * the dependency and leaves the open path to say so.
 */
export type ArqfsSidecarDependency =
  /** Everything committed to this database is inside these bytes. */
  | 'complete'
  /** Newer commits may live in a `-wal` sidecar that is not part of these bytes. */
  | 'write-ahead-log-sidecar';

export type ArqfsBytePreflightResult =
  | {
      readonly status: 'accepted';
      readonly pageSize: number;
      readonly estimatedPageCount: number;
      readonly applicationId: number;
      readonly schemaVersion: number;
      readonly writeVersion: 1 | 2;
      readonly readVersion: 1 | 2;
      readonly journalMode: ArqfsJournalMode;
      readonly sidecarDependency: ArqfsSidecarDependency;
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
  if (
    !Number.isSafeInteger(policy.maxFileBytes) ||
    policy.maxFileBytes < MINIMUM_SQLITE_HEADER_BYTES ||
    !Number.isSafeInteger(policy.maxPageCount) ||
    policy.maxPageCount < 1
  ) {
    return {
      status: 'rejected',
      code: 'ARQ_PREFLIGHT_POLICY_INVALID',
      reason: 'Preflight policy is invalid.',
    };
  }
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
  const writeVersion = bytes[18];
  const readVersion = bytes[19];
  if ((writeVersion !== 1 && writeVersion !== 2) || (readVersion !== 1 && readVersion !== 2)) {
    return {
      status: 'rejected',
      code: 'ARQ_INVALID_JOURNAL_MODE',
      reason: 'SQLite journal mode header is invalid.',
    };
  }
  if ((bytes[20] ?? 0) >= pageSize) {
    return {
      status: 'rejected',
      code: 'ARQ_INVALID_RESERVED_BYTES',
      reason: 'SQLite reserved-byte count is invalid.',
    };
  }
  if (bytes[21] !== 64 || bytes[22] !== 32 || bytes[23] !== 32) {
    return {
      status: 'rejected',
      code: 'ARQ_INVALID_PAYLOAD_FRACTIONS',
      reason: 'SQLite payload fraction header is invalid.',
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
  const declaredPageCount = readU32BE(bytes, 28);
  const physicalPageCount = Math.floor(bytes.byteLength / pageSize);
  if (physicalPageCount < 1 || bytes.byteLength % pageSize !== 0) {
    return {
      status: 'rejected',
      code: 'ARQ_FILE_TRUNCATED',
      reason: 'SQLite file bytes do not contain complete pages.',
    };
  }
  if (declaredPageCount > policy.maxPageCount || physicalPageCount > policy.maxPageCount) {
    return {
      status: 'rejected',
      code: 'ARQ_PAGE_LIMIT_EXCEEDED',
      reason: 'File exceeds configured page-count limit.',
    };
  }
  if (declaredPageCount > 0 && declaredPageCount > physicalPageCount) {
    return {
      status: 'rejected',
      code: 'ARQ_FILE_TRUNCATED',
      reason: 'SQLite page count exceeds the bytes available in the file.',
    };
  }
  const estimatedPageCount =
    declaredPageCount > 0 ? declaredPageCount : Math.ceil(bytes.byteLength / pageSize);
  // Either version reading 2 is treated as a write-ahead log. SQLite sets both
  // together, so they normally agree; when they do not, the file is odd enough
  // that assuming the sidecar might matter is the safer of the two readings -
  // the cost of an unnecessary caution is a sentence, and the cost of a missed
  // one is silently showing stale work.
  const journalMode: ArqfsJournalMode =
    writeVersion === 2 || readVersion === 2 ? 'write-ahead-log' : 'rollback-journal';
  return {
    status: 'accepted',
    pageSize,
    estimatedPageCount,
    applicationId,
    schemaVersion,
    writeVersion: writeVersion as 1 | 2,
    readVersion: readVersion as 1 | 2,
    journalMode,
    sidecarDependency: journalMode === 'write-ahead-log' ? 'write-ahead-log-sidecar' : 'complete',
  };
}
