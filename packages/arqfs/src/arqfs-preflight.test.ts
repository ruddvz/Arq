import { describe, expect, it } from 'vitest';
import { preflightArqfsBytes } from './arqfs-preflight';

function header(applicationId: number): Uint8Array {
  const bytes = new Uint8Array(4096);
  bytes.set(new TextEncoder().encode('SQLite format 3\0'));
  bytes[16] = 0x10;
  bytes[17] = 0;
  bytes[18] = 1;
  bytes[19] = 1;
  bytes[21] = 64;
  bytes[22] = 32;
  bytes[23] = 32;
  bytes[60] = 0;
  bytes[61] = 0;
  bytes[62] = 0;
  bytes[63] = 2;
  bytes[68] = (applicationId >>> 24) & 0xff;
  bytes[69] = (applicationId >>> 16) & 0xff;
  bytes[70] = (applicationId >>> 8) & 0xff;
  bytes[71] = applicationId & 0xff;
  return bytes;
}

describe('preflightArqfsBytes', () => {
  it('accepts a bounded native header', () => {
    expect(preflightArqfsBytes(header(0x41525131))).toMatchObject({
      status: 'accepted',
      schemaVersion: 2,
      pageSize: 4096,
    });
  });

  it('rejects the wrong application ID', () => {
    expect(preflightArqfsBytes(header(0x12345678))).toMatchObject({
      status: 'rejected',
      code: 'ARQ_APPLICATION_ID_MISMATCH',
    });
  });

  it('rejects truncated input', () => {
    expect(preflightArqfsBytes(new Uint8Array(50))).toMatchObject({
      status: 'rejected',
      code: 'ARQ_FILE_TRUNCATED',
    });
  });

  it('rejects a header-sized input whose page bytes are incomplete', () => {
    const bytes = header(0x41525131).subarray(0, 100);
    expect(preflightArqfsBytes(bytes)).toMatchObject({
      status: 'rejected',
      code: 'ARQ_FILE_TRUNCATED',
    });
  });

  it('rejects invalid journal mode and payload fraction headers', () => {
    const invalidJournal = header(0x41525131);
    invalidJournal[18] = 0;
    expect(preflightArqfsBytes(invalidJournal)).toMatchObject({
      status: 'rejected',
      code: 'ARQ_INVALID_JOURNAL_MODE',
    });

    const invalidFractions = header(0x41525131);
    invalidFractions[21] = 0;
    expect(preflightArqfsBytes(invalidFractions)).toMatchObject({
      status: 'rejected',
      code: 'ARQ_INVALID_PAYLOAD_FRACTIONS',
    });
  });

  it('rejects a declared page count that is larger than the bytes available', () => {
    const bytes = header(0x41525131);
    bytes[28] = 0;
    bytes[29] = 0;
    bytes[30] = 0;
    bytes[31] = 2;
    expect(preflightArqfsBytes(bytes)).toMatchObject({
      status: 'rejected',
      code: 'ARQ_FILE_TRUNCATED',
    });
  });
});
