import { describe, expect, it } from 'vitest';
import { describeFileFlowState } from './describe-file-flow-state';
import type { FileFlowState } from './file-state-machine';

describe('describeFileFlowState', () => {
  /**
   * `native-opening` is a compatibility verdict, not an open. That was true when
   * nothing in this build could open a project and it is still true now that
   * something can: the checks that decide whether this project opens have not
   * run yet, so this state must not speak for them.
   */
  it('never claims a project is open for the native-opening state', () => {
    const description = describeFileFlowState({
      kind: 'native-opening',
      name: 'house.arq',
      sidecarDependency: 'complete',
    });
    expect(description.headline).not.toMatch(/is open|opened successfully/i);
    expect(description.headline).toMatch(/compatible/i);
  });

  /**
   * The silent-staleness case. SQLite opened without a write-ahead log's `-wal`
   * sidecar does not fail - it returns the database as of the last checkpoint -
   * so an accepted file can be missing the user's most recent saved work with
   * nothing reporting a problem. The copy has to name the companion file and a
   * way out, because a caution the reader cannot act on is only alarming.
   */
  it('warns that a write-ahead-log project may be missing its newest work, and says how to get it', () => {
    const description = describeFileFlowState({
      kind: 'native-opening',
      name: 'house.arq',
      sidecarDependency: 'write-ahead-log-sidecar',
    });

    expect(description.tone).toBe('warning');
    expect(description.headline).toMatch(/may not be complete/i);
    // Names the actual artifact the user has to find, not just "a companion file".
    expect(description.detail).toMatch(/-wal/);
    expect(description.detail).toMatch(/reopen and close|Choose the/i);
    // Still never claims the project is open.
    expect(description.headline).not.toMatch(/is open|opened successfully/i);
  });

  it('says something materially different for a complete file than an incomplete one', () => {
    const complete = describeFileFlowState({
      kind: 'native-opening',
      name: 'house.arq',
      sidecarDependency: 'complete',
    });
    const incomplete = describeFileFlowState({
      kind: 'native-opening',
      name: 'house.arq',
      sidecarDependency: 'write-ahead-log-sidecar',
    });

    expect(complete.headline).not.toBe(incomplete.headline);
    expect(complete.tone).toBe('neutral');
    expect(incomplete.tone).toBe('warning');
  });

  it('surfaces the real failure code and message, not a generic error string', () => {
    const description = describeFileFlowState({
      kind: 'failed',
      name: 'house.arq',
      code: 'ARQ_FILE_TRUNCATED',
      message: 'SQLite page count exceeds the bytes available in the file.',
    });
    expect(description.tone).toBe('error');
    expect(description.detail).toBe(
      'ARQ_FILE_TRUNCATED: SQLite page count exceeds the bytes available in the file.',
    );
  });

  it('handles a failure with no file name yet (rejected before a name was ever acquired)', () => {
    const description = describeFileFlowState({
      kind: 'failed',
      code: 'NO_FORMAT_CANDIDATE',
      message: 'No file format candidate was produced.',
    });
    expect(description.headline).toBe('This file could not be opened.');
  });

  it('surfaces the real safe-mode reason, not a paraphrase', () => {
    const description = describeFileFlowState({
      kind: 'read-only-safe-mode',
      name: 'house.arq',
      reason: 'a previous local write did not reach commit',
    });
    expect(description.tone).toBe('warning');
    expect(description.detail).toBe('a previous local write did not reach commit');
  });

  it('describes every state kind without throwing (exhaustiveness)', () => {
    const states: readonly FileFlowState[] = [
      { kind: 'idle' },
      { kind: 'acquiring', name: 'a.arq' },
      { kind: 'detecting', name: 'a.arq' },
      { kind: 'native-opening', name: 'a.arq', sidecarDependency: 'complete' },
      { kind: 'native-opening', name: 'a.arq', sidecarDependency: 'write-ahead-log-sidecar' },
      { kind: 'import-options', name: 'a.dxf', formatId: 'dxf' },
      { kind: 'importing', name: 'a.dxf', requestId: 'r1', fraction: 0.5 },
      { kind: 'staged-review', name: 'a.dxf', requestId: 'r1' },
      { kind: 'migrating', name: 'a.arq', fraction: 0.5 },
      { kind: 'read-only-safe-mode', name: 'a.arq', reason: 'corrupt' },
      { kind: 'failed', code: 'X', message: 'y' },
    ];
    for (const state of states) {
      expect(() => describeFileFlowState(state)).not.toThrow();
      expect(describeFileFlowState(state).headline.length).toBeGreaterThan(0);
    }
  });

  /**
   * The state that only exists because this build can now really open a project.
   * A user told a project is open will try to edit it, so the same sentence that
   * says "open" has to say "read-only" and has to say the chosen file is
   * untouched - otherwise the true half is read as permission for the rest.
   */
  it('says a project is open, and in the same breath what cannot be done with it', () => {
    const description = describeFileFlowState({
      kind: 'workspace-active',
      name: 'house.arq',
      projectId: 'open-1',
      readOnlyReason: 'build-cannot-write',
      facts: {
        projectName: 'Courtyard House Reference',
        revision: 191,
        sidecarDependency: 'complete',
        conditionNote: null,
      },
    });

    expect(description.headline).toBe(
      'Courtyard House Reference is open, read-only · revision 191',
    );
    expect(description.detail).toMatch(/does not edit or save/i);
    expect(description.detail).toMatch(/unchanged/i);
    expect(description.tone).toBe('neutral');
  });

  /**
   * Two causes, two sentences. Telling a reader their file is from a newer ARQ
   * when the real limit is this build is a false statement about their own work,
   * so the copy must not collapse the two into one read-only apology.
   */
  it('names the cause of read-only rather than assuming one', () => {
    const byFile = describeFileFlowState({
      kind: 'workspace-active',
      name: 'house.arq',
      projectId: 'p1',
      readOnlyReason: 'newer-format-version',
      facts: {
        projectName: 'House',
        revision: 4,
        sidecarDependency: 'complete',
        conditionNote: null,
      },
    });

    expect(byFile.detail).toMatch(/newer version of ARQ/i);
    expect(byFile.detail).not.toMatch(/does not edit or save/i);
  });

  it('says nothing about read-only when the project is writable', () => {
    const description = describeFileFlowState({
      kind: 'workspace-active',
      name: 'house.arq',
      projectId: 'p1',
      readOnlyReason: null,
      facts: {
        projectName: 'House',
        revision: 4,
        sidecarDependency: 'complete',
        conditionNote: null,
      },
    });

    expect(description.headline).toBe('House is open · revision 4');
    expect(description.headline).not.toMatch(/read-only/i);
    expect(description.detail).toBeNull();
  });

  it('keeps the write-ahead-log caution after a successful open', () => {
    const description = describeFileFlowState({
      kind: 'workspace-active',
      name: 'house.arq',
      projectId: 'open-1',
      readOnlyReason: 'build-cannot-write',
      facts: {
        projectName: 'House',
        revision: 4,
        sidecarDependency: 'write-ahead-log-sidecar',
        conditionNote: null,
      },
    });

    // A successful open must not swallow the fact that the newest work may be in
    // a sidecar the file picker never handed over.
    expect(description.tone).toBe('warning');
    expect(description.detail).toMatch(/-wal/);
  });

  it('adds a file condition note when the open found one worth stating', () => {
    const description = describeFileFlowState({
      kind: 'workspace-active',
      name: 'house.arq',
      projectId: 'open-1',
      readOnlyReason: 'build-cannot-write',
      facts: {
        projectName: 'House',
        revision: 4,
        sidecarDependency: 'complete',
        conditionNote: 'A previous write to this project did not finish.',
      },
    });

    expect(description.detail).toMatch(/did not finish/);
  });

  /**
   * The states between preflight and an active workspace are the ones a false
   * open would hide in, so none of them may use the word.
   */
  it('never says a project is open before hydration finishes', () => {
    const inFlight: readonly FileFlowState[] = [
      { kind: 'worker-open', name: 'house.arq', projectId: 'p1', readOnlyReason: null },
      {
        kind: 'worker-open',
        name: 'house.arq',
        projectId: 'p1',
        readOnlyReason: 'build-cannot-write',
      },
      { kind: 'hydrating', name: 'house.arq', projectId: 'p1', readOnlyReason: null },
    ];
    for (const state of inFlight) {
      const description = describeFileFlowState(state);
      expect(description.tone).toBe('progress');
      expect(description.headline).not.toMatch(/\bis open\b/);
      // No fabricated fraction: neither stage has a measurable one.
      expect(description.headline).not.toMatch(/%/);
    }
  });
});
