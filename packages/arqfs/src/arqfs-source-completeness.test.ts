import { describe, expect, it } from 'vitest';
import {
  evaluateArqfsSourceCompleteness,
  ARQFS_SOURCE_COMPLETENESS_CODES,
} from './arqfs-source-completeness';

const ARQ_APPLICATION_ID = 0x41525131;

/**
 * A minimal but structurally valid Arq SQLite header. `journalMode` writes the
 * file-format read/write version bytes SQLite itself sets: 1 for a rollback
 * journal (whole database in one file) and 2 for a write-ahead log (newest
 * commits may live in a `-wal` sidecar).
 */
function header(
  journalMode: 'rollback-journal' | 'write-ahead-log',
  applicationId = ARQ_APPLICATION_ID,
): Uint8Array {
  const bytes = new Uint8Array(4096);
  bytes.set(new TextEncoder().encode('SQLite format 3\0'));
  bytes[16] = 0x10;
  bytes[17] = 0;
  const version = journalMode === 'write-ahead-log' ? 2 : 1;
  bytes[18] = version;
  bytes[19] = version;
  bytes[21] = 64;
  bytes[22] = 32;
  bytes[23] = 32;
  bytes[63] = 2;
  bytes[68] = (applicationId >>> 24) & 0xff;
  bytes[69] = (applicationId >>> 16) & 0xff;
  bytes[70] = (applicationId >>> 8) & 0xff;
  bytes[71] = applicationId & 0xff;
  return bytes;
}

describe('evaluateArqfsSourceCompleteness', () => {
  it('accepts a rollback-journal database, which is whole in one file', () => {
    const result = evaluateArqfsSourceCompleteness(header('rollback-journal'));

    expect(result.status).toBe('complete');
    if (result.status === 'complete') {
      expect(result.journalMode).toBe('rollback-journal');
      expect(result.preflight.applicationId).toBe(ARQ_APPLICATION_ID);
    }
  });

  /**
   * The defect this policy exists for. SQLite opens this file without error and
   * returns the database as of its last checkpoint, so accepting it shows the
   * user an apparently healthy project that is silently missing their most
   * recent saved work. It is refused before anything is copied or opened.
   */
  it('refuses a write-ahead-log database whose sidecar was not supplied', () => {
    const result = evaluateArqfsSourceCompleteness(header('write-ahead-log'));

    expect(result).toMatchObject({
      status: 'rejected',
      code: ARQFS_SOURCE_COMPLETENESS_CODES.walSidecarRequired,
    });
  });

  it('tells the user how to make the database complete, rather than only naming the fault', () => {
    const result = evaluateArqfsSourceCompleteness(header('write-ahead-log'));

    expect(result.status).toBe('rejected');
    if (result.status === 'rejected') {
      // A refusal a user cannot act on is only marginally better than a silent
      // stale open, so the remedy - close it cleanly in the writing application
      // - is part of the contract, not incidental wording.
      expect(result.reason).toContain('close it cleanly');
      expect(result.reason).toContain('-wal');
    }
  });

  it('treats a single WAL version byte as a sidecar dependency, taking the safer reading', () => {
    // SQLite normally sets both bytes together. When they disagree the file is
    // odd enough that assuming the sidecar might matter costs a sentence, while
    // assuming it does not can cost the user work.
    const bytes = header('rollback-journal');
    bytes[18] = 2;

    expect(evaluateArqfsSourceCompleteness(bytes)).toMatchObject({
      status: 'rejected',
      code: ARQFS_SOURCE_COMPLETENESS_CODES.walSidecarRequired,
    });
  });

  /**
   * A preflight rejection keeps its own code rather than being flattened into a
   * generic failure: truncation and "not an Arq file" are different problems
   * with different remedies, and the open path has to tell them apart.
   */
  it('passes a truncated file through with its own rejection code', () => {
    expect(evaluateArqfsSourceCompleteness(new Uint8Array(50))).toMatchObject({
      status: 'rejected',
      code: 'ARQ_FILE_TRUNCATED',
    });
  });

  it('passes a non-Arq SQLite file through with its own rejection code', () => {
    expect(evaluateArqfsSourceCompleteness(header('rollback-journal', 0x12345678))).toMatchObject({
      status: 'rejected',
      code: 'ARQ_APPLICATION_ID_MISMATCH',
    });
  });

  it('rejects a file that is not SQLite at all', () => {
    expect(evaluateArqfsSourceCompleteness(new Uint8Array(4096))).toMatchObject({
      status: 'rejected',
      code: 'ARQ_NOT_SQLITE',
    });
  });

  it('checks completeness before compatibility is even relevant, so an unopenable file is never adopted', () => {
    // Truncation is detected from bytes alone. Nothing here constructs a driver,
    // touches OPFS or creates a working copy - which is the point: the refusal
    // has to land before any of that happens.
    const results = [
      evaluateArqfsSourceCompleteness(new Uint8Array(50)),
      evaluateArqfsSourceCompleteness(header('write-ahead-log')),
    ];

    expect(results.every((result) => result.status === 'rejected')).toBe(true);
  });
});
