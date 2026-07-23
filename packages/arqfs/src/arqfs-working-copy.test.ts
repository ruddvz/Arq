import { describe, expect, it, afterEach } from 'vitest';
import { createNodeArqfsDriver } from './arqfs-node-driver';
import { createArqfsSchemaV1 } from './arqfs-schema';
import {
  initializeWorkingCopyState,
  readWorkingCopyState,
  beginLocalWrite,
  commitLocalWrite,
  failLocalWrite,
} from './arqfs-working-copy';
import type { ArqfsDriver } from './arqfs-driver';

describe('arqfs-working-copy', () => {
  let driver: ArqfsDriver;

  afterEach(() => {
    driver?.close();
  });

  function freshDriver(): ArqfsDriver {
    driver = createNodeArqfsDriver();
    createArqfsSchemaV1(driver);
    return driver;
  }

  it('returns null before initialization', () => {
    const d = freshDriver();
    expect(readWorkingCopyState(d)).toBeNull();
  });

  it('initializes with revision 0, clean/offline/not-linked, and no server revision or linked path', () => {
    const d = freshDriver();
    initializeWorkingCopyState(d, 'project-1');

    expect(readWorkingCopyState(d)).toEqual({
      projectId: 'project-1',
      localRevision: 0,
      localCommitState: 'clean',
      syncState: 'offline',
      publicationState: 'not-linked',
    });
  });

  it('is exactly one row - a second initialization attempt fails rather than creating a second working copy', () => {
    const d = freshDriver();
    initializeWorkingCopyState(d, 'project-1');
    expect(() => initializeWorkingCopyState(d, 'project-2')).toThrow();
  });

  it('advances local_revision only on a real commit, not on begin', () => {
    const d = freshDriver();
    initializeWorkingCopyState(d, 'project-1');

    beginLocalWrite(d);
    expect(readWorkingCopyState(d)?.localCommitState).toBe('writing');
    expect(readWorkingCopyState(d)?.localRevision).toBe(0);

    commitLocalWrite(d);
    expect(readWorkingCopyState(d)?.localCommitState).toBe('clean');
    expect(readWorkingCopyState(d)?.localRevision).toBe(1);
  });

  it('a failed write does not advance the revision', () => {
    const d = freshDriver();
    initializeWorkingCopyState(d, 'project-1');

    beginLocalWrite(d);
    failLocalWrite(d);

    expect(readWorkingCopyState(d)).toMatchObject({ localCommitState: 'failed', localRevision: 0 });
  });

  it('multiple commits advance the revision monotonically', () => {
    const d = freshDriver();
    initializeWorkingCopyState(d, 'project-1');

    commitLocalWrite(d);
    commitLocalWrite(d);
    commitLocalWrite(d);

    expect(readWorkingCopyState(d)?.localRevision).toBe(3);
  });
});
