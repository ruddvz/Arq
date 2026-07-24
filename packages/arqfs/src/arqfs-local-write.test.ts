import { describe, expect, it, afterEach } from 'vitest';
import { createNodeArqfsDriver } from './arqfs-node-driver';
import { createArqfsSchemaV1 } from './arqfs-schema';
import {
  initializeWorkingCopyState,
  readWorkingCopyState,
  beginLocalWrite,
  runArqfsLocalWrite,
  recoverInterruptedLocalWrite,
} from './arqfs-working-copy';
import { getArchiveEntry, listArchiveEntryPaths } from './arqfs-archive-store';
import type { ArqfsDriver } from './arqfs-driver';

const bytes = (text: string): Uint8Array => new TextEncoder().encode(text);

describe('runArqfsLocalWrite (durable local write boundary)', () => {
  let driver: ArqfsDriver;

  afterEach(() => {
    driver?.close();
  });

  function freshDriver(): ArqfsDriver {
    driver = createNodeArqfsDriver();
    createArqfsSchemaV1(driver);
    initializeWorkingCopyState(driver, 'project-1');
    return driver;
  }

  it('commits the mutation, advances the revision exactly once and clears the marker', () => {
    const d = freshDriver();

    const result = runArqfsLocalWrite(d, (context) => {
      context.putArchiveEntry('manifest.json', bytes('{"a":1}'));
      return context.previousRevision;
    });

    expect(result).toEqual({ status: 'committed', revision: 1, value: 0 });
    expect(readWorkingCopyState(d)).toMatchObject({
      localCommitState: 'clean',
      localRevision: 1,
    });
    expect(getArchiveEntry(d, 'manifest.json')).toEqual(bytes('{"a":1}'));
  });

  /**
   * The whole point of the boundary: a mutation that throws must leave no partial
   * canonical state and must not look committed. The revision stays put and the
   * marker records `failed` so safe-mode UI can explain it rather than silently
   * presenting a half-written project as saved.
   */
  it('rolls the mutation back, keeps the revision and records failed when the mutation throws', () => {
    const d = freshDriver();
    runArqfsLocalWrite(d, (context) => context.putArchiveEntry('manifest.json', bytes('first')));

    const result = runArqfsLocalWrite(d, (context) => {
      context.putArchiveEntry('manifest.json', bytes('second'));
      context.putArchiveEntry('model.json', bytes('partial'));
      throw new Error('mutation exploded');
    });

    expect(result).toEqual({
      status: 'rejected',
      previousRevision: 1,
      reason: 'mutation exploded',
    });
    expect(readWorkingCopyState(d)).toMatchObject({
      localCommitState: 'failed',
      localRevision: 1,
    });
    // Neither the overwrite nor the extra entry survived.
    expect(getArchiveEntry(d, 'manifest.json')).toEqual(bytes('first'));
    expect(listArchiveEntryPaths(d)).toEqual(['manifest.json']);
  });

  it('exposes the committed entries to the mutation through its own read accessor', () => {
    const d = freshDriver();
    runArqfsLocalWrite(d, (context) => context.putArchiveEntry('manifest.json', bytes('v1')));

    const result = runArqfsLocalWrite(d, (context) => {
      const previous = context.readArchiveEntry('manifest.json');
      context.removeArchiveEntry('manifest.json');
      return previous;
    });

    expect(result).toMatchObject({ status: 'committed', revision: 2 });
    expect(getArchiveEntry(d, 'manifest.json')).toBeNull();
  });

  /**
   * A marker left by a crash means the previous write never reached commit. Another
   * write must not proceed over it - recovery has to be an explicit decision first.
   */
  it('refuses a new write while an interrupted write is still marked, until recovery runs', () => {
    const d = freshDriver();
    beginLocalWrite(d); // simulates a crash between marker and commit

    const blocked = runArqfsLocalWrite(d, (context) =>
      context.putArchiveEntry('manifest.json', bytes('should not commit')),
    );

    expect(blocked).toEqual({
      status: 'rejected',
      previousRevision: 0,
      reason: 'an interrupted local write requires recovery before another write',
    });
    expect(getArchiveEntry(d, 'manifest.json')).toBeNull();

    expect(recoverInterruptedLocalWrite(d)).toMatchObject({
      localCommitState: 'failed',
      localRevision: 0,
    });

    const afterRecovery = runArqfsLocalWrite(d, (context) =>
      context.putArchiveEntry('manifest.json', bytes('now safe')),
    );
    expect(afterRecovery).toMatchObject({ status: 'committed', revision: 1 });
  });

  it('leaves an already-clean working copy untouched when recovery runs with nothing to recover', () => {
    const d = freshDriver();

    expect(recoverInterruptedLocalWrite(d)).toMatchObject({
      localCommitState: 'clean',
      localRevision: 0,
    });
  });

  it('rejects rather than throwing when the working copy state was never initialized', () => {
    driver = createNodeArqfsDriver();
    createArqfsSchemaV1(driver);

    expect(runArqfsLocalWrite(driver, () => 'unused')).toEqual({
      status: 'rejected',
      previousRevision: 0,
      reason: 'working copy state is not initialized',
    });
  });

  /** A policy rejection inside the mutation is a rejection, not a partial write. */
  it('rejects a policy-violating entry without committing anything', () => {
    const d = freshDriver();

    const result = runArqfsLocalWrite(d, (context) =>
      context.putArchiveEntry('../escape.json', bytes('nope')),
    );

    expect(result.status).toBe('rejected');
    expect(readWorkingCopyState(d)).toMatchObject({ localRevision: 0 });
    expect(listArchiveEntryPaths(d)).toEqual([]);
  });
});
