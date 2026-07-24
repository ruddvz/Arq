const SQLITE_HEADER = new TextEncoder().encode('SQLite format 3\0');
export const ARQ_APPLICATION_ID = 0x41525131;
export const SQLITE_HEADER_BYTES = 100;

export type NativeArqHeaderResult =
  | {
      readonly status: 'valid-arq-header';
      readonly applicationId: number;
      readonly schemaVersion: number;
      readonly pageSize: number;
    }
  | {
      readonly status: 'invalid';
      readonly code: string;
      readonly detail: string;
    };

function readU32BE(bytes: Uint8Array, offset: number): number {
  return (
    ((bytes[offset] ?? 0) * 0x1000000 +
      ((bytes[offset + 1] ?? 0) << 16) +
      ((bytes[offset + 2] ?? 0) << 8) +
      (bytes[offset + 3] ?? 0)) >>>
    0
  );
}

function startsWith(bytes: Uint8Array, prefix: Uint8Array): boolean {
  if (bytes.byteLength < prefix.byteLength) return false;
  for (let index = 0; index < prefix.byteLength; index += 1) {
    if (bytes[index] !== prefix[index]) return false;
  }
  return true;
}

export function inspectNativeArqHeader(bytes: Uint8Array): NativeArqHeaderResult {
  if (bytes.byteLength < SQLITE_HEADER_BYTES) {
    return {
      status: 'invalid',
      code: 'ARQ_HEADER_TRUNCATED',
      detail: 'File is shorter than the SQLite header.',
    };
  }
  if (!startsWith(bytes, SQLITE_HEADER)) {
    return { status: 'invalid', code: 'ARQ_NOT_SQLITE', detail: 'SQLite signature is missing.' };
  }

  const encodedPageSize = ((bytes[16] ?? 0) << 8) | (bytes[17] ?? 0);
  const pageSize = encodedPageSize === 1 ? 65_536 : encodedPageSize;
  if (pageSize < 512 || pageSize > 65_536 || (pageSize & (pageSize - 1)) !== 0) {
    return {
      status: 'invalid',
      code: 'ARQ_INVALID_PAGE_SIZE',
      detail: 'SQLite page size is invalid.',
    };
  }

  const schemaVersion = readU32BE(bytes, 60);
  const applicationId = readU32BE(bytes, 68);
  if (applicationId !== ARQ_APPLICATION_ID) {
    return {
      status: 'invalid',
      code: 'ARQ_APPLICATION_ID_MISMATCH',
      detail: 'SQLite application ID does not identify an Arq project.',
    };
  }
  return { status: 'valid-arq-header', applicationId, schemaVersion, pageSize };
}
