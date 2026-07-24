import { describe, expect, it } from 'vitest';
import {
  ArqfsPolicyError,
  DEFAULT_ARQFS_STORAGE_POLICY,
  validateArqfsArchivePath,
  validateArchiveEntryBytes,
  validateArchiveTotals,
  validateChunkSize,
  validateResourceShape,
  validateArqfsStoragePolicy,
  validateResourceMetadata,
} from './arqfs-policy';

describe('arqfs storage policy', () => {
  it('accepts normal logical paths and rejects host-path aliases', () => {
    expect(() => validateArqfsArchivePath('imports/source.dxf')).not.toThrow();
    for (const path of ['', '/absolute', '\\absolute', '../escape', 'a/../b', 'a\\b', 'C:\\file']) {
      expect(() => validateArqfsArchivePath(path)).toThrow(ArqfsPolicyError);
    }
  });

  it('enforces archive entry and total budgets', () => {
    const policy = {
      ...DEFAULT_ARQFS_STORAGE_POLICY,
      maxArchiveEntryBytes: 4,
      maxArchiveTotalBytes: 6,
    };
    expect(() => validateArchiveEntryBytes('model.json', new Uint8Array(5), policy)).toThrow(
      /entry exceeds/i,
    );
    expect(() => validateArchiveTotals(2, 7, policy)).toThrow(/archive size/i);
  });

  it('rejects zero, fractional and oversized resource chunks', () => {
    expect(() => validateChunkSize(0)).toThrow(ArqfsPolicyError);
    expect(() => validateChunkSize(1.5)).toThrow(ArqfsPolicyError);
    expect(() => validateResourceShape(10, 4, 3)).not.toThrow();
    expect(() => validateResourceShape(10, 4, 2)).toThrow(ArqfsPolicyError);
  });

  it('rejects malformed caller-supplied policies before they can bypass a limit', () => {
    expect(() =>
      validateArqfsStoragePolicy({ ...DEFAULT_ARQFS_STORAGE_POLICY, maxArchiveEntries: 0 }),
    ).toThrow(/positive integer/i);
    expect(() =>
      validateArqfsStoragePolicy({
        ...DEFAULT_ARQFS_STORAGE_POLICY,
        maxArchiveEntryBytes: 9,
        maxArchiveTotalBytes: 8,
      }),
    ).toThrow(/cannot exceed/i);
  });

  it('keeps resource metadata bounded and role-scoped', () => {
    expect(() => validateResourceMetadata('image/png', 'user-texture')).not.toThrow();
    expect(() => validateResourceMetadata('', 'user-texture')).toThrow(ArqfsPolicyError);
    expect(() => validateResourceMetadata('image/png', 'unknown-role')).toThrow(ArqfsPolicyError);
  });
});
