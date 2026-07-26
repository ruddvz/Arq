import { describe, expect, it } from 'vitest';
import { evaluateOpenCapabilities } from './arqfs-open';
import type { ArqFormatVersion } from './arqfs-header';

const reader: ArqFormatVersion = {
  major: 1,
  minor: 0,
  schema: 2,
  minReaderMajor: 1,
  minWriterMajor: 1,
};

describe('arqfs open capability safety', () => {
  it('does not let an older major read a newer major merely because minReaderMajor is malformed or permissive', () => {
    const result = evaluateOpenCapabilities(
      { major: 2, minor: 0, schema: 2, minReaderMajor: 1, minWriterMajor: 2 },
      reader,
    );
    expect(result.canRead).toBe(false);
    expect(result.canWrite).toBe(false);
    expect(result.safeModeRequired).toBe(true);
  });

  it('does not let a reader write a schema it does not understand', () => {
    const result = evaluateOpenCapabilities(
      { major: 1, minor: 0, schema: 3, minReaderMajor: 1, minWriterMajor: 1 },
      reader,
    );
    expect(result.canRead).toBe(false);
    expect(result.canWrite).toBe(false);
    expect(result.canMigrate).toBe(false);
    expect(result.unsupportedRequiredFeatures).toContain('schema-too-new-for-reader');
  });

  it('allows a newer reader to migrate an older same-major schema', () => {
    const result = evaluateOpenCapabilities(
      { major: 1, minor: 0, schema: 1, minReaderMajor: 1, minWriterMajor: 1 },
      reader,
    );
    expect(result).toEqual({
      canRead: true,
      canWrite: true,
      canMigrate: true,
      safeModeRequired: false,
      unsupportedRequiredFeatures: [],
    });
  });
});
