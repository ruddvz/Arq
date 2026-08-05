import { describe, expect, it } from 'vitest';
import type { ArqfsOpenResult } from '@arq/arqfs';
import {
  resolveNativeOpenCapabilities,
  assertResumedProjectIdentity,
  NativeProjectIdentityError,
  type RememberedProjectDescriptor,
} from './native-open-policy';

type OpenedResult = Extract<ArqfsOpenResult, { status: 'opened' }>;

const CURRENT_WRITABLE: OpenedResult = {
  status: 'opened',
  header: { major: 1, minor: 0, schema: 2, minReaderMajor: 1, minWriterMajor: 1 },
  capabilities: {
    canRead: true,
    canWrite: true,
    canMigrate: false,
    safeModeRequired: false,
    unsupportedRequiredFeatures: [],
  },
};

function withCapabilities(overrides: Partial<OpenedResult['capabilities']>): ArqfsOpenResult {
  return {
    ...CURRENT_WRITABLE,
    capabilities: { ...CURRENT_WRITABLE.capabilities, ...overrides },
  };
}

describe('resolveNativeOpenCapabilities', () => {
  it('keeps a current, fully supported project editable', () => {
    expect(resolveNativeOpenCapabilities(CURRENT_WRITABLE)).toEqual({
      readOnly: false,
      warnings: [],
    });
  });

  /**
   * `canMigrate` means the format *could* be brought forward, not that the
   * product may write to it. Copy-on-write migration exists as a library but is
   * not user-reachable and its recovery evidence has not been run end to end, so
   * authoring here would write current semantics into a file still declaring the
   * old schema (ADR-0028).
   */
  it('opens an older compatible schema read-only until migration is reachable', () => {
    const result = resolveNativeOpenCapabilities(withCapabilities({ canMigrate: true }));

    expect(result.readOnly).toBe(true);
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0]).toMatch(/migration/i);
  });

  it('opens a project needing a newer writer read-only, explaining why', () => {
    const result = resolveNativeOpenCapabilities(withCapabilities({ canWrite: false }));

    expect(result.readOnly).toBe(true);
    expect(result.warnings[0]).toMatch(/newer version/i);
  });

  it('opens a project this build cannot fully understand read-only', () => {
    const result = resolveNativeOpenCapabilities(
      withCapabilities({ canRead: false, safeModeRequired: true }),
    );

    expect(result.readOnly).toBe(true);
    expect(result.warnings[0]).toMatch(/does not understand/i);
  });

  it('never reports a rejected open as an editable project', () => {
    const result = resolveNativeOpenCapabilities({ status: 'rejected', reason: 'not an Arq file' });

    expect(result.readOnly).toBe(true);
    expect(result.warnings[0]).toContain('not an Arq file');
  });

  it('gives one reason, not a stack of them, when a project is both old and unwritable', () => {
    // A future-writer file is the more specific and more actionable statement;
    // telling the user about a migration they also cannot run would be noise.
    const result = resolveNativeOpenCapabilities(
      withCapabilities({ canWrite: false, canMigrate: true }),
    );

    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0]).toMatch(/newer version/i);
  });
});

describe('assertResumedProjectIdentity', () => {
  const descriptor: RememberedProjectDescriptor = {
    workingCopyId: `project-${'00000000-0000-4000-8000-000000000001'}`,
    projectId: '00000000-0000-4000-8000-000000000001',
    displayName: 'Remembered project',
  };

  it('accepts a working copy whose manifest is the project the pointer named', () => {
    expect(() =>
      assertResumedProjectIdentity(descriptor, {
        workingCopyId: descriptor.workingCopyId,
        projectId: descriptor.projectId,
      }),
    ).not.toThrow();
  });

  /**
   * The pointer and the database are separate state that can drift: an OPFS file
   * can be replaced or recreated under a reused id while the descriptor survives
   * in local storage. Trusting the pointer would reopen project B under project
   * A's name, and the first save would write A's edits into B.
   */
  it('refuses a working copy whose manifest identifies a different project', () => {
    expect(() =>
      assertResumedProjectIdentity(descriptor, {
        workingCopyId: descriptor.workingCopyId,
        projectId: '00000000-0000-4000-8000-000000000099',
      }),
    ).toThrow(NativeProjectIdentityError);
  });

  it('refuses when the working copy that opened is not the one the pointer named', () => {
    expect(() =>
      assertResumedProjectIdentity(descriptor, {
        workingCopyId: 'project-somewhere-else',
        projectId: descriptor.projectId,
      }),
    ).toThrow(NativeProjectIdentityError);
  });
});
