import { describe, expect, it } from 'vitest';
import { describeFileFlowState } from './describe-file-flow-state';
import type { FileFlowState } from './file-state-machine';

describe('describeFileFlowState', () => {
  /**
   * `native-opening` is progress, not a verdict: the bytes were accepted and the
   * project is being copied into a local working copy. It must not claim the
   * project is open, because the decode and adoption that make that true have
   * not happened yet - `workspace-active` is the only state entitled to say so.
   */
  it('reports native-opening as work in progress, not as an opened project', () => {
    const description = describeFileFlowState({
      kind: 'native-opening',
      name: 'house.arq',
      sidecarDependency: 'complete',
    });

    expect(description.tone).toBe('progress');
    expect(description.headline).toMatch(/opening/i);
    expect(description.headline).not.toMatch(/is open\b|opened successfully/i);
    // Names where the copy goes, so "opening" does not read as "uploading".
    expect(description.detail).toMatch(/local working copy/i);
  });

  it('says a project is open only once it has actually been adopted', () => {
    const description = describeFileFlowState({
      kind: 'workspace-active',
      name: 'house.arq',
      projectId: 'p1',
      writable: true,
    });

    expect(description.tone).toBe('neutral');
    expect(description.headline).toBe('house.arq is open.');
  });

  /**
   * A project that silently refuses edits is a bug report; one that says so is a
   * product. Read-only rides on the state decided at Worker open, so a file that
   * opened read-only is provably still read-only when the workspace renders it.
   */
  it('says so when a project opened read-only', () => {
    const description = describeFileFlowState({
      kind: 'workspace-active',
      name: 'house.arq',
      projectId: 'p1',
      writable: false,
    });

    expect(description.tone).toBe('warning');
    expect(description.headline).toMatch(/read-only/i);
    // The reason travels with the state rather than leaving the user to find it
    // by trying to draw.
    expect(description.detail).toContain('newer version');
  });

  /**
   * The silent-staleness case, now handled by refusing rather than cautioning.
   *
   * SQLite opened without a write-ahead log's `-wal` sidecar does not fail - it
   * returns the database as of the last checkpoint - so an accepted file can be
   * missing the user's most recent saved work with nothing reporting a problem.
   * That used to reach `native-opening` and be described as "compatible, but it
   * may not be complete". A caution shown beside a project that is already on
   * screen is not a safeguard, so the state is now a failure with its own code.
   */
  it('reports a missing write-ahead-log sidecar as a failure, naming the file and the way out', () => {
    const description = describeFileFlowState({
      kind: 'failed',
      name: 'house.arq',
      code: 'ARQ_WAL_SIDECAR_REQUIRED',
      message:
        'This database depends on a companion "-wal" file that was not included, so it may be missing the newest saved work. Reopen the project in the application that created it and close it cleanly, which folds the companion file back into the database, then choose the database again.',
    });

    expect(description.tone).toBe('error');
    expect(description.headline).toMatch(/could not be opened/i);
    // Names the actual artifact the user has to find, and the remedy.
    expect(description.detail).toMatch(/-wal/);
    expect(description.detail).toMatch(/close it cleanly/i);
    expect(description.detail).toContain('ARQ_WAL_SIDECAR_REQUIRED');
  });

  /**
   * There is no longer a variant of `native-opening` that means "accepted, but
   * possibly stale" - if the flow reaches it at all, the bytes are whole.
   */
  it('has no state that hedges about completeness', () => {
    const description = describeFileFlowState({
      kind: 'native-opening',
      name: 'house.arq',
      sidecarDependency: 'complete',
    });

    expect(description.headline).not.toMatch(/may not be complete/i);
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

  /**
   * The rule the state-language map already states for this machine: "published"
   * is licensed only after the file was reopened and verified. Before this the
   * copy asserted that check had happened while no such check existed anywhere in
   * the flow, which is the strongest form of the claim being wrong - the
   * reassurance was the fabrication.
   */
  it('does not say a project file was published while the file is still being checked', () => {
    const description = describeFileFlowState({
      kind: 'publication-verifying',
      name: 'house.arq',
      projectId: 'p1',
      writable: true,
    });

    expect(description.headline).not.toMatch(/published/i);
    expect(description.tone).toBe('progress');
  });

  it('names the exact revision it published, so the claim can be checked', () => {
    const description = describeFileFlowState({
      kind: 'published',
      name: 'house.arq',
      projectId: 'p1',
      writable: true,
      revision: 214,
      semanticHash: 'deadbeef',
    });

    expect(description.headline).toContain('214');
    expect(description.detail).toMatch(/reopened and checked/i);
  });

  it('never calls publishing a sync or a save', () => {
    const publishStates: readonly FileFlowState[] = [
      { kind: 'publishing', name: 'a.arq', projectId: 'p1', fraction: 0.5, writable: true },
      { kind: 'publication-verifying', name: 'a.arq', projectId: 'p1', writable: true },
      {
        kind: 'published',
        name: 'a.arq',
        projectId: 'p1',
        writable: true,
        revision: 2,
        semanticHash: 'h',
      },
    ];

    for (const state of publishStates) {
      const { headline, detail } = describeFileFlowState(state);
      const copy = `${headline} ${detail ?? ''}`;
      expect(copy).not.toMatch(/synced|saved|auto-saved/i);
    }
  });

  it('describes every state kind without throwing (exhaustiveness)', () => {
    const states: readonly FileFlowState[] = [
      { kind: 'idle' },
      { kind: 'staging', name: 'a.arq', fraction: 0.25 },
      { kind: 'staged', name: 'a.arq', projectId: 'p1' },
      { kind: 'migration-verified', name: 'a.arq', projectId: 'p1' },
      { kind: 'worker-open', name: 'a.arq', projectId: 'p1', writable: true },
      { kind: 'hydrating', name: 'a.arq', projectId: 'p1', writable: true },
      { kind: 'quarantined', name: 'a.arq', quarantinePath: '/q/a.arq', lastKnownGood: null },
      { kind: 'cancelled', name: 'a.arq', cancelledAt: 'staging', lastKnownGood: null },
      {
        kind: 'project-failed',
        name: 'a.arq',
        reason: 'publication-failed',
        detail: 'd',
        lastKnownGood: null,
      },
      {
        kind: 'recovery-available',
        name: 'a.arq',
        projectId: 'p1',
        journalledOperations: 2,
        writable: true,
      },
      { kind: 'recovering', name: 'a.arq', projectId: 'p1', writable: true },
      { kind: 'publishing', name: 'a.arq', projectId: 'p1', fraction: 0.5, writable: true },
      { kind: 'publication-verifying', name: 'a.arq', projectId: 'p1', writable: true },
      {
        kind: 'published',
        name: 'a.arq',
        projectId: 'p1',
        writable: true,
        revision: 2,
        semanticHash: 'h',
      },
      { kind: 'closed', lastKnownGood: null },
      { kind: 'acquiring', name: 'a.arq' },
      { kind: 'detecting', name: 'a.arq' },
      { kind: 'native-opening', name: 'a.arq', sidecarDependency: 'complete' },
      { kind: 'workspace-active', name: 'a.arq', projectId: 'p1', writable: true },
      { kind: 'workspace-active', name: 'a.arq', projectId: 'p1', writable: false },
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
});
